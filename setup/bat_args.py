import os
import runpy
import sys

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
script = os.path.abspath(sys.argv[1])
sys.argv = [script, *sys.argv[3:]]
sys.path[0] = os.path.dirname(script)
runpy.run_path(script, run_name="__main__")
