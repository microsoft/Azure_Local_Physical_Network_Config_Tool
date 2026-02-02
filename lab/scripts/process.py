#!/usr/bin/env python3
"""
Lab Processor — Thin Wrapper

This is a convenience wrapper for local testing. The actual processing logic
lives in backend/src/submission_processor.py.

Usage:
    cd lab
    python scripts/process.py submissions/example-dell-tor1 -v
"""

import argparse
import json
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).parent.parent.parent / 'backend'
sys.path.insert(0, str(BACKEND_DIR))

from src.submission_processor import process_submission, ProcessingResult


def main():
    parser = argparse.ArgumentParser(
        description='Process switch config submissions',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/process.py submissions/example-dell-tor1
  python scripts/process.py submissions/example-cisco-tor1 -v
  python scripts/process.py submissions/test-typos-dell --json
        """
    )
    parser.add_argument('submission', type=Path, help='Path to submission folder')
    parser.add_argument('--output', '-o', type=Path, help='Output directory (default: output/<name>)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    
    # Validate submission directory
    if not args.submission.exists():
        print(f"Error: Submission directory not found: {args.submission}")
        sys.exit(1)
    
    if not args.submission.is_dir():
        print(f"Error: Not a directory: {args.submission}")
        sys.exit(1)
    
    # Set output directory
    output_dir = args.output or Path('output') / args.submission.name
    
    # Process
    result = process_submission(args.submission, output_dir, verbose=args.verbose)
    
    # Output
    if args.json:
        print(json.dumps({
            'success': result.success,
            'submission': result.submission,
            'metadata': result.metadata,
            'detected': result.detected,
            'sections': result.sections,
            'analysis': result.analysis,
            'errors': result.errors,
            'warnings': result.warnings,
            'output_dir': result.output_dir,
        }, indent=2))
    else:
        if result.success:
            print(f"\n✓ Successfully processed: {args.submission.name}")
            
            # Show new vendor banner
            if result.validation_result and result.validation_result.is_new_vendor:
                if not args.verbose:
                    print(f"  🎉 New vendor contribution: {result.metadata.get('vendor', 'unknown')}")
            
            print(f"  Vendor:   {result.metadata.get('vendor', 'unknown')}")
            print(f"  Firmware: {result.metadata.get('firmware', 'unknown')}")
            print(f"  Hostname: {result.metadata.get('hostname', 'N/A')}")
            print(f"  Role:     {result.metadata.get('role', 'N/A')}")
            print(f"  Pattern:  {result.metadata.get('deployment_pattern', 'N/A')}")
            print(f"\n  Sections: {', '.join(result.sections)}")
            print(f"\n  Output:   {result.output_dir}")
            
            # Show warnings
            if result.warnings:
                print(f"\n  ⚠️  Warnings:")
                for warning in result.warnings:
                    print(f"     • {warning}")
            
            if args.verbose and result.analysis:
                print(f"\n  Analysis:")
                for key, value in result.analysis.items():
                    print(f"    {key}: {value}")
        else:
            print(f"\n✗ Failed to process: {args.submission.name}")
            for error in result.errors:
                print(f"  Error: {error}")
            sys.exit(1)


if __name__ == '__main__':
    main()
