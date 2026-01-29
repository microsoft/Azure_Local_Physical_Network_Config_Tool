"""CLI Entry Point - Command-line interface for Azure Local Network Config Tool"""
import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from .validator import StandardValidator
from .transformer import Transformer
from .context import ContextBuilder
from .renderer import Renderer


def validate_command(args):
    """Execute validate command"""
    input_path = Path(args.input)
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        return 1
    
    # Load input JSON
    try:
        with open(input_path, 'r') as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}", file=sys.stderr)
        return 1
    
    # Validate
    validator = StandardValidator()
    result = validator.validate(config)
    
    if result.is_valid:
        print("✓ Validation successful")
        return 0
    else:
        print("✗ Validation failed:", file=sys.stderr)
        for error in result.errors:
            print(f"  {error}", file=sys.stderr)
        return 1


def transform_command(args):
    """Execute transform command"""
    input_path = Path(args.input)
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        return 1
    
    # Load input JSON
    try:
        with open(input_path, 'r') as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}", file=sys.stderr)
        return 1
    
    # Validate first
    validator = StandardValidator()
    result = validator.validate(config)
    
    if not result.is_valid:
        print("✗ Validation failed:", file=sys.stderr)
        for error in result.errors:
            print(f"  {error}", file=sys.stderr)
        return 1
    
    # Transform
    transformer = Transformer()
    enriched = transformer.transform(config)
    
    # Output enriched JSON
    print(json.dumps(enriched, indent=2))
    return 0


def generate_command(args):
    """Execute generate command"""
    input_path = Path(args.input)
    output_dir = Path(args.output) if args.output else Path.cwd()
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        return 1
    
    # Load input JSON
    try:
        with open(input_path, 'r') as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}", file=sys.stderr)
        return 1
    
    # Validate
    validator = StandardValidator()
    result = validator.validate(config)
    
    if not result.is_valid:
        print("✗ Validation failed:", file=sys.stderr)
        for error in result.errors:
            print(f"  {error}", file=sys.stderr)
        return 1
    
    # Transform
    transformer = Transformer()
    enriched = transformer.transform(config)
    
    # Build context
    context_builder = ContextBuilder()
    context = context_builder.build_context(enriched)
    
    # Render
    try:
        renderer = Renderer()
        vendor = config["switch"]["vendor"]
        firmware = config["switch"]["firmware"]
        hostname = config["switch"]["hostname"]
        
        # Get main template
        template_path = renderer.get_main_template(vendor, firmware)
        
        # Render to file
        output_file = output_dir / f"{hostname}.cfg"
        renderer.render_to_file(template_path, context, output_file)
        
        print(f"✓ Configuration generated: {output_file}")
        return 0
        
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except jinja2.TemplateNotFound as e:
        print(f"Error: Template not found: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        prog='azlocal-netconfig',
        description='Azure Local Network Switch Configuration Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Validate a configuration file
  azlocal-netconfig validate config.json
  
  # Transform and enrich configuration
  azlocal-netconfig transform config.json
  
  # Generate switch configuration files
  azlocal-netconfig generate config.json -o output/
  azlocal-netconfig generate config.json  # outputs to current directory
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Validate command
    validate_parser = subparsers.add_parser(
        'validate',
        help='Validate JSON configuration against schema'
    )
    validate_parser.add_argument('input', help='Input JSON file path')
    
    # Transform command
    transform_parser = subparsers.add_parser(
        'transform',
        help='Validate and transform configuration (outputs enriched JSON)'
    )
    transform_parser.add_argument('input', help='Input JSON file path')
    
    # Generate command
    generate_parser = subparsers.add_parser(
        'generate',
        help='Generate switch configuration files'
    )
    generate_parser.add_argument('input', help='Input JSON file path')
    generate_parser.add_argument(
        '-o', '--output',
        help='Output directory (default: current directory)',
        default=None
    )
    
    # Parse arguments
    args = parser.parse_args()
    
    # Execute command
    if args.command == 'validate':
        return validate_command(args)
    elif args.command == 'transform':
        return transform_command(args)
    elif args.command == 'generate':
        return generate_command(args)
    else:
        parser.print_help()
        return 1


if __name__ == '__main__':
    sys.exit(main())
