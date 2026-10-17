module.exports = {
    apps: [
        {
            name: 'bet-mentor-proxy',
            script: 'server/proxy.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '350M',
            exp_backoff_restart_delay: 100,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/proxy-error.log',
            out_file: './logs/proxy-out.log',
            merge_logs: true,
            env: {
                NODE_ENV: 'production',
                PORT: 3001
            }
        }
    ]
};
