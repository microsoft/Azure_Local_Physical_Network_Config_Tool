"""Template Renderer - Jinja2 template rendering"""
from pathlib import Path
from typing import Dict, Any, Optional
import jinja2


class Renderer:
    """Renders Jinja2 templates to network configuration files"""
    
    def __init__(self, template_dir: Optional[Path] = None):
        """
        Initialize renderer with template directory
        
        Args:
            template_dir: Path to templates directory. Defaults to backend/templates/
        """
        if template_dir is None:
            template_dir = Path(__file__).parent.parent / "templates"
        
        self.template_dir = template_dir
        
        # Configure Jinja2 environment
        self.env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(template_dir)),
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=True
        )
        
        # Add custom filters
        self._add_custom_filters()
    
    def _add_custom_filters(self):
        """Add custom Jinja2 filters for network config rendering"""
        
        def parse_interface_range(start: str, end: str) -> str:
            """Convert start/end to Dell OS10 range format"""
            return f"{start}-{end}"
        
        def subnet_mask(cidr: int) -> str:
            """Convert CIDR to subnet mask"""
            mask = (0xFFFFFFFF << (32 - cidr)) & 0xFFFFFFFF
            return f"{(mask >> 24) & 0xFF}.{(mask >> 16) & 0xFF}.{(mask >> 8) & 0xFF}.{mask & 0xFF}"
        
        self.env.filters["parse_interface_range"] = parse_interface_range
        self.env.filters["subnet_mask"] = subnet_mask
    
    def render_template(self, template_path: str, context: Dict[str, Any]) -> str:
        """
        Render a template with given context
        
        Args:
            template_path: Relative path to template (e.g., 'dellemc/os10/system.j2')
            context: Template context data
            
        Returns:
            Rendered configuration string
        """
        template = self.env.get_template(template_path)
        return template.render(context)
    
    def render_to_file(self, template_path: str, context: Dict[str, Any], output_path: Path):
        """
        Render template and write to file
        
        Args:
            template_path: Relative path to template
            context: Template context data
            output_path: Output file path
        """
        rendered = self.render_template(template_path, context)
        
        # Create output directory if it doesn't exist
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            f.write(rendered)
    
    def get_main_template(self, vendor: str, firmware: str) -> str:
        """
        Get the main template path for vendor/firmware combination
        
        Args:
            vendor: Vendor name (cisco, dellemc)
            firmware: Firmware type (nxos, os10)
            
        Returns:
            Template path string
        """
        template_map = {
            ("cisco", "nxos"): "cisco/nxos/full_config.j2",
            ("dellemc", "os10"): "dellemc/os10/full_config.j2"
        }
        
        key = (vendor.lower(), firmware.lower())
        if key not in template_map:
            raise ValueError(f"No template found for {vendor}/{firmware}")
        
        return template_map[key]
