module.exports = {
    apps: [
        {
            name: "vite-frontend",
            script: "npm",
            args: "run dev",
            cwd: "./",
            watch: false,
            env: {
                NODE_ENV: "development",
            }
        },
        {
            name: "api-proxy",
            script: "server/proxy.js",
            cwd: "./",
            watch: false, // Scraper logs might satisfy watch triggers too often
            env: {
                NODE_ENV: "production",
                PORT: 3001
            }
        }
    ]
};
