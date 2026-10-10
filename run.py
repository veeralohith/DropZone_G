import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
STARTUP_TIMEOUT = 120


def npm_command(arguments):
    command = ["npm", *arguments]
    if os.name == "nt":
        return subprocess.run(
            subprocess.list2cmdline(command),
            cwd=ROOT,
            shell=True,
            check=False,
        )
    return subprocess.run(command, cwd=ROOT, check=False)


def choose_port(requested_port):
    if requested_port:
        with socket.socket() as probe:
            probe.settimeout(0.25)
            if probe.connect_ex(("127.0.0.1", requested_port)) == 0:
                requested_port = None

    if requested_port:
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", requested_port))
                return requested_port
            except OSError:
                pass

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def stop_process(process):
    if process.poll() is not None:
        return

    try:
        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=8)
    except (OSError, subprocess.TimeoutExpired):
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except OSError:
                pass
        process.wait()


def main():
    if not shutil.which("npm"):
        print("Node.js and npm are required. Install Node.js, then run this script again.", file=sys.stderr)
        return 1

    if not (ROOT / "package.json").is_file():
        print("Could not find package.json beside run.py.", file=sys.stderr)
        return 1

    executable_suffix = ".cmd" if os.name == "nt" else ""
    required_tools = [
        ROOT / "node_modules" / ".bin" / f"tsx{executable_suffix}",
        ROOT / "node_modules" / ".bin" / f"vite{executable_suffix}",
    ]
    if not all(tool.is_file() for tool in required_tools):
        print("Installing backend and frontend dependencies from package.json...")
        install_result = npm_command(["install", "--no-package-lock"])
        if install_result.returncode != 0:
            print("Dependency installation failed.", file=sys.stderr)
            return install_result.returncode
        if not all(tool.is_file() for tool in required_tools):
            print("npm install finished, but required project tools are missing.", file=sys.stderr)
            return 1
    else:
        print("Backend and frontend dependencies are already installed.")

    try:
        requested_port = int(os.environ.get("PORT", "3000"))
        if not 1 <= requested_port <= 65535:
            raise ValueError
    except ValueError:
        print("PORT must be a number between 1 and 65535.", file=sys.stderr)
        return 1

    port = choose_port(requested_port)
    if port != requested_port:
        print(f"Port {requested_port} is occupied; using port {port} instead.")

    url = f"http://localhost:{port}"
    server_env = os.environ.copy()
    server_env["PORT"] = str(port)
    command = "npm run dev" if os.name == "nt" else ["npm", "run", "dev"]
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        env=server_env,
        shell=os.name == "nt",
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        start_new_session=os.name != "nt",
    )

    print(f"Starting DropZone at {url}")
    deadline = time.monotonic() + STARTUP_TIMEOUT
    try:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                print("The development server exited before it became ready.", file=sys.stderr)
                return process.returncode or 1
            try:
                with urllib.request.urlopen(url, timeout=2):
                    print("DropZone is ready. Press Ctrl+C to stop the server.")
                    if not webbrowser.open(url):
                        print(f"Open this URL in your browser: {url}")
                    return process.wait()
            except (OSError, urllib.error.URLError):
                time.sleep(0.5)

        print(f"The server did not become ready within {STARTUP_TIMEOUT} seconds.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nStopping DropZone...")
        return 0
    finally:
        stop_process(process)


if __name__ == "__main__":
    raise SystemExit(main())
