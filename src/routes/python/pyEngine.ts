import { loadPyodide } from "pyodide";

let pyodide: any;
let ready: Promise<void> | null = null;

export function initPy() {
    if (!ready) {
        ready = (async () => {
            pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"
            });
        })();
    }
    return ready;
}

export async function runPython(script: string, data: any) {
    await initPy();

    // ✅ Convert JS → real Python object
    const pyData = pyodide.toPy(data);

    pyodide.globals.set("input_data", pyData);

    await pyodide.runPythonAsync(script);

    const hasProcess = pyodide.runPython(
        `'process' in globals() and callable(process)`
    );

    if (!hasProcess) {
        throw new Error("Script must define process(data)");
    }

    const result = await pyodide.runPythonAsync(`process(input_data)`);

    return result;
}