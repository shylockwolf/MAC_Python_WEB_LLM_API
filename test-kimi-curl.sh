#!/bin/bash

curl -x socks5://127.0.0.1:12345 \
  -X POST "https://integrate.api.nvidia.com/v1/chat/completions" \
  -H "Authorization: Bearer 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" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "moonshotai/kimi-k2.5",
    "messages": [{"role": "user", "content": "你好"}],
    "max_tokens": 100,
    "temperature": 1.00,
    "stream": false
  }'