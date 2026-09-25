const { spawn } = require("node:child_process");
const path = require("node:path");

const server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    stdio: "inherit",
    env: { ...process.env, LOCAL_SERVER_PORT: "4174" }
});

server.on("exit", code => {
    process.exitCode = code ?? 0;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.kill(signal));
}
