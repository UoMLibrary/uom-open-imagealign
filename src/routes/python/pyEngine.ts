import { loadPyodide, version } from "pyodide";

let pyodide: any;
let ready: Promise<void> | null = null;

export function initPy() {
    if (!ready) {
        ready = (async () => {
            pyodide = await loadPyodide({
                indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`
            });
        })();
    }
    return ready;
}

export async function runPython(script: string, data: any) {
    await initPy();

    // ✅ Convert JS → Python
    const pyData = pyodide.toPy(data);
    pyodide.globals.set("input_data", pyData);

    // Run user script
    await pyodide.runPythonAsync(script);

    const hasProcess = pyodide.runPython(
        `'process' in globals() and callable(process)`
    );

    if (!hasProcess) {
        throw new Error("Script must define process(data)");
    }

    // ✅ SAFE RETURN PATH (JSON only)
    const jsonResult = await pyodide.runPythonAsync(`
import json
json.dumps(process(input_data))
`);

    // ✅ Convert to JS
    return JSON.parse(jsonResult);
}