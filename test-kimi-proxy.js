const testKimiViaProxy = async () => {
  const invokeUrl = 'http://localhost:3000/api/kimi/v1/chat/completions';
  const stream = false;

  const headers = {
    'Authorization': 'Bearer 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',
    'Accept': stream ? 'text/event-stream' : 'application/json',
    'Content-Type': 'application/json'
  };

  const payload = {
    'model': 'moonshotai/kimi-k2.5',
    'messages': [{ 'role': 'user', 'content': '你好，请简单介绍一下你自己' }],
    'max_tokens': 16384,
    'temperature': 1.00,
    'top_p': 1.00,
    'stream': stream,
    'chat_template_kwargs': { 'thinking': true }
  };

  try {
    console.log('Sending request to Kimi API via Vite proxy...');
    const response = await fetch(invokeUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response:', errorData);
      return;
    }

    const data = await response.json();
    console.log('Success! Response:', JSON.stringify(data, null, 2));
    
    if (data.choices && data.choices[0]) {
      console.log('Generated text:', data.choices[0].message.content);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
};

testKimiViaProxy();