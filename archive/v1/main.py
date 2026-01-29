import argparse
from pathlib import Path
import sys
import json
import shutil
import importlib
from generator import generate_config
from loader import get_real_path, load_input_json  # Only used for PyInstaller-packed assets

def load_convertor(convertor_module_path):
    """
    Dynamically load a convertor module and return its convert function.
    
    Args:
        convertor_module_path: String path to convertor module (e.g., "convertors.convertors_lab_switch_json")
    
    Returns:
        Function that can convert input data to standard format
    """
    try:
        # Import the module
        module = importlib.import_module(convertor_module_path)
        
        # Look for the conversion function (assuming it's named convert_switch_input_json)
        if hasattr(module, 'convert_switch_input_json'):
            return module.convert_switch_input_json
        else:
            raise AttributeError(f"Module {convertor_module_path} does not have 'convert_switch_input_json' function")
            
    except ImportError as e:
        raise ImportError(f"Failed to import convertor module '{convertor_module_path}': {e}")
    except Exception as e:
        raise RuntimeError(f"Failed to load convertor from '{convertor_module_path}': {e}")

def is_standard_format(data):
    """
    Check if the JSON data is in standard format by looking for expected top-level keys.
    Standard format should have: switch, vlans, interfaces, port_channels, bgp, prefix_lists, qos
    Lab format will have: Version, Description, InputData
    """
    if not isinstance(data, dict):
        return False
    
    # Standard format indicators
    standard_keys = {"switch", "vlans", "interfaces"}
    has_standard_keys = any(key in data for key in standard_keys)
    
    # Lab format indicators
    lab_keys = {"Version", "Description", "InputData"}
    has_lab_keys = any(key in data for key in lab_keys)
    
    return has_standard_keys and not has_lab_keys

def convert_to_standard_format(input_file_path, output_dir, convertor_module_path):
    """
    Convert lab format to standard format JSON files using specified convertor.
    Returns list of generated standard format files.
    """
    print("🔄 Converting from lab format to standard format...")
    print(f"📦 Using convertor: {convertor_module_path}")
    
    # Load lab format data
    data = load_input_json(str(input_file_path))
    if data is None:
        raise ValueError(f"Failed to load input file: {input_file_path}")
    
    # Load the convertor function
    convert_function = load_convertor(convertor_module_path)
    
    # Convert to standard format
    convert_function(data, output_dir)
    
    # Find generated standard format files
    output_path = Path(output_dir)
    generated_files = list(output_path.glob("*.json"))
    
    if not generated_files:
        raise RuntimeError("No standard format files were generated during conversion")
    
    print(f"✅ Generated {len(generated_files)} standard format files:")
    for file in generated_files:
        print(f"   - {file}")
    
    return generated_files

def main():
    parser = argparse.ArgumentParser(
        description="Network config generator - automatically detects input format and converts if needed, then generates configs.",
        epilog="Workflow: 1) Check if input is standard format 2) If not, convert using specified convertor 3) Generate config files from standard format"
    )

    parser.add_argument("--input_json", required=True,
                        help="Path to input JSON file (can be lab format or standard format)")

    parser.add_argument("--template_folder", default="input/jinja2_templates",
                        help="Root folder containing vendor templates (default: input/jinja2_templates)")

    parser.add_argument("--output_folder", default=".",
        help="Directory to save generated config files (default: current directory)"
    )

    parser.add_argument("--convertor", default="convertors.convertors_lab_switch_json",
        help="Python module path for the convertor to use when input is not in standard format. Only used if conversion is needed. (default: convertors.convertors_lab_switch_json)")

    args = parser.parse_args()

    # Resolve paths
    input_json_path = Path(args.input_json).resolve()
    output_folder_path = Path(args.output_folder).resolve()
    template_folder_arg = Path(args.template_folder)

    # Only use get_real_path if user did NOT override default
    if args.template_folder == parser.get_default('template_folder'):
        template_folder = get_real_path(template_folder_arg)
    else:
        template_folder = template_folder_arg.resolve()

    print(f"🧾 Input JSON File:     {input_json_path}")
    print(f"🧩 Template Folder:     {template_folder}")
    print(f"📁 Output Directory:    {output_folder_path}")
    if args.convertor != parser.get_default('convertor'):
        print(f"🔄 Custom Convertor:    {args.convertor}")

    # === Validation ===
    if not input_json_path.exists():
        print(f"[ERROR] Input file not found: {input_json_path}")
        sys.exit(1)

    if not template_folder.exists():
        print(f"[ERROR] Template folder not found: {template_folder}")
        sys.exit(1)

    output_folder_path.mkdir(parents=True, exist_ok=True)

    # === Step 1: Check if input is in standard format ===
    print("🔍 Checking input format...")
    data = load_input_json(str(input_json_path))
    if data is None:
        print(f"[ERROR] Failed to load input JSON: {input_json_path}")
        sys.exit(1)

    standard_format_files = []

    if is_standard_format(data):
        print("✅ Input is already in standard format")
        standard_format_files = [input_json_path]
    else:
        print("⚠️  Input is in lab format - conversion required")
        try:
            # Create temporary subdirectory for conversion within output folder
            temp_conversion_subdir = output_folder_path / ".temp_conversion"
            temp_conversion_subdir.mkdir(parents=True, exist_ok=True)
            
            # Convert to standard format using temporary subdirectory
            standard_format_files = convert_to_standard_format(
                input_json_path, 
                str(temp_conversion_subdir),
                args.convertor
            )
        except Exception as e:
            print(f"❌ Failed to convert to standard format: {e}")
            print(f"\n💡 Troubleshooting tips:")
            print(f"   - Ensure your input file is in the correct format for convertor: {args.convertor}")
            print(f"   - Check if the convertor module exists and has 'convert_switch_input_json' function")
            print(f"   - For custom convertors, use: --convertor your.custom.convertor.module")
            sys.exit(1)

    # === Step 2: Generate configs for each standard format file ===
    print(f"\n🏗️  Generating configs for {len(standard_format_files)} switch(es)...")
    
    total_success = 0
    total_failed = 0
    conversion_used = not is_standard_format(data)

    for std_file in standard_format_files:
        print(f"\n📝 Processing: {std_file.name}")
        
        try:
            # Create subdirectory for each switch's output
            switch_output_dir = output_folder_path / std_file.stem
            switch_output_dir.mkdir(parents=True, exist_ok=True)
            
            # If conversion was used, copy the standard JSON to the switch output directory for troubleshooting
            if conversion_used:
                import shutil
                std_json_copy = switch_output_dir / f"std_{std_file.name}"
                shutil.copy2(std_file, std_json_copy)
                print(f"📄 Standard JSON saved: {std_json_copy.name}")
            
            generate_config(
                input_std_json=str(std_file),
                template_folder=str(template_folder),
                output_folder=str(switch_output_dir)
            )
            total_success += 1
            print(f"✅ Generated configs for {std_file.name} in {switch_output_dir}")
            
        except Exception as e:
            print(f"❌ Failed to generate configs for {std_file.name}: {e}")
            total_failed += 1

    # === Cleanup conversion artifacts ===
    if conversion_used:
        # Clean up temporary conversion subdirectory
        temp_conversion_subdir = output_folder_path / ".temp_conversion"
        if temp_conversion_subdir.exists():
            print(f"\n🧹 Cleaning up temporary conversion directory...")
            shutil.rmtree(temp_conversion_subdir, ignore_errors=True)
        
        # Keep the original converted JSON files in the root directory for user verification
        print("� Original converted JSON files kept in output directory for verification")

    # === Summary ===
    print(f"\n🎯 Summary:")
    print(f"   ✅ Successfully processed: {total_success} switch(es)")
    if total_failed > 0:
        print(f"   ❌ Failed to process: {total_failed} switch(es)")
    print(f"   📁 Output directory: {output_folder_path}")

    if total_failed > 0:
        sys.exit(1)
    else:
        print("🎉 All configs generated successfully!")

if __name__ == "__main__":
    main()
