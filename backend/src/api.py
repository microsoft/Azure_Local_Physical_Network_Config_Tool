"""
FastAPI Backend for Azure Local Physical Network Config Tool

Provides REST API endpoints for generating switch configurations from JSON input.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Any, Dict, Optional
import json

from .validator import StandardValidator
from .transformer import Transformer
from .context import ContextBuilder
from .renderer import Renderer

# ============================================================================
# APP SETUP
# ============================================================================

app = FastAPI(
    title="Azure Local Physical Network Config API",
    description="Generate reference switch configurations for Azure Local deployments",
    version="1.0.0"
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class GenerateRequest(BaseModel):
    """Request body for /api/generate endpoint"""
    config: Dict[str, Any]
    
class GenerateResponse(BaseModel):
    """Response for /api/generate endpoint"""
    success: bool
    config: Optional[str] = None
    filename: Optional[str] = None
    error: Optional[str] = None
    validation_errors: Optional[list] = None

class HealthResponse(BaseModel):
    """Response for /health endpoint"""
    status: str
    version: str

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(status="healthy", version="1.0.0")


@app.post("/api/generate", response_model=GenerateResponse)
async def generate_config(request: GenerateRequest):
    """
    Generate switch configuration from JSON input.
    
    This endpoint:
    1. Validates the input JSON against the schema
    2. Transforms/enriches the config
    3. Renders using Jinja2 templates
    4. Returns the configuration text
    
    > [!IMPORTANT]
    > Generated configurations are REFERENCE ONLY.
    > Customer is responsible for validation before production use.
    """
    config = request.config
    
    # Step 1: Validate
    validator = StandardValidator()
    result = validator.validate(config)
    
    if not result.is_valid:
        # Convert ValidationError objects to strings for JSON serialization
        error_strings = [str(e) for e in result.errors]
        return GenerateResponse(
            success=False,
            error="Validation failed",
            validation_errors=error_strings
        )
    
    # Step 2: Transform/Enrich
    try:
        transformer = Transformer()
        enriched = transformer.transform(config)
    except Exception as e:
        return GenerateResponse(
            success=False,
            error=f"Transform failed: {str(e)}"
        )
    
    # Step 3: Build context
    try:
        context_builder = ContextBuilder()
        context = context_builder.build_context(enriched)
    except Exception as e:
        return GenerateResponse(
            success=False,
            error=f"Context build failed: {str(e)}"
        )
    
    # Step 4: Render
    try:
        renderer = Renderer()
        vendor = config["switch"]["vendor"]
        firmware = config["switch"]["firmware"]
        hostname = config["switch"]["hostname"]
        
        template_path = renderer.get_main_template(vendor, firmware)
        rendered_config = renderer.render_template(template_path, context)
        
        filename = f"{hostname}.cfg"
        
        return GenerateResponse(
            success=True,
            config=rendered_config,
            filename=filename
        )
        
    except ValueError as e:
        return GenerateResponse(
            success=False,
            error=f"Template not found: {str(e)}"
        )
    except Exception as e:
        return GenerateResponse(
            success=False,
            error=f"Render failed: {str(e)}"
        )


@app.post("/api/generate/raw", response_class=PlainTextResponse)
async def generate_config_raw(request: GenerateRequest):
    """
    Generate switch configuration and return as plain text.
    
    Same as /api/generate but returns raw config text directly,
    suitable for direct download.
    """
    result = await generate_config(request)
    
    if not result.success:
        raise HTTPException(
            status_code=400,
            detail=result.error or "Generation failed"
        )
    
    return PlainTextResponse(
        content=result.config,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{result.filename}"'
        }
    )


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def run_server(host: str = "0.0.0.0", port: int = 8000):
    """Run the API server"""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_server()
