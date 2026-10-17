module.exports = {
    apps: [
        {
            name: "vite-frontend",
            script: "npm",
            args: "run dev",
            cwd: "./",
            watch: false,
            max_memory_restart: '250M',
            exp_backoff_restart_delay: 200,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/frontend-error.log',
            out_file: './logs/frontend-out.log',
            env: {
                NODE_ENV: "development",
            }
        },
        {
            name: "api-proxy",
            script: "server/proxy.js",
            cwd: "./",
            watch: false,
            max_memory_restart: '350M',
            exp_backoff_restart_delay: 200,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/proxy-error.log',
            out_file: './logs/proxy-out.log',
            merge_logs: true,
            env: {
                NODE_ENV: "production",
                PORT: 3001
            }
        }
    ]
};
