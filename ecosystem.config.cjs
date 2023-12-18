module.exports = {
    apps: [{
        name: 'chat-node',
        script: './bin/server.js',
        env: {
            NODE_ENV: 'production',
            API_PORT: 6001,
            API_HOST: '0.0.0.0',
            UPSTREAM: 'https://api.openai-proxy.org/v1/chat/completions',
            OPENAI_MODEL: 'gpt-3.5-turbo',
        },
    }],
};
