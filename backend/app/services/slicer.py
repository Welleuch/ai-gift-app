import subprocess
import re

PRUSA_PATH = "C:\\Program Files\\Prusa3D\\PrusaSlicer\\prusa-slicer-console.exe" # Adjust path
CONFIG_PATH = "config.ini"

def slice_and_estimate(input_stl):
    output_gcode = input_stl.replace(".stl", ".gcode")
    
    # Run PrusaSlicer Headless
    # We use --load to load your specific printer settings
    process = subprocess.run([
        PRUSA_PATH,
        "--export-gcode",
        "--load", CONFIG_PATH,
        "--output", output_gcode,
        input_stl
    ], capture_output=True, text=True)
    
    log_output = process.stdout
    
    # Parse the output for estimates (PrusaSlicer outputs this in console)
    # Example output: "Estimated printing time: 1h 30m 10s"
    
    time_match = re.search(r"Estimated printing time: (.*)", log_output)
    cost_match = re.search(r"Cost: (.*)", log_output) # You might need to check exact output format
    
    print_time = time_match.group(1) if time_match else "Unknown"
    
    return {
        "gcode_path": output_gcode,
        "estimated_time": print_time,
        "status": "success"
    }