import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DebugPage = () => {
  const [results, setResults] = useState([]);

  const tests = [
    {
      name: 'Backend Health Check',
      url: 'https://allendatahub-backend.onrender.com/api/health',
      method: 'GET'
    },
    {
      name: 'Data Plans Endpoint', 
      url: 'https://allendatahub-backend.onrender.com/api/plans',
      method: 'GET'
    },
    {
      name: 'Root Endpoint',
      url: 'https://allendatahub-backend.onrender.com/',
      method: 'GET'
    }
  ];

  const runTests = async () => {
    const testResults = [];
    
    for (const test of tests) {
      try {
        console.log(`🧪 Running: ${test.name}`);
        const startTime = Date.now();
        const response = await axios.get(test.url, { timeout: 10000 });
        const endTime = Date.now();
        
        testResults.push({
          name: test.name,
          status: '✅ SUCCESS',
          statusCode: response.status,
          responseTime: `${endTime - startTime}ms`,
          data: response.data
        });
        
        console.log(`✅ ${test.name}:`, response.status, response.data);
      } catch (error) {
        testResults.push({
          name: test.name,
          status: '❌ FAILED',
          statusCode: error.response?.status || 'No response',
          error: error.message,
          details: error.response?.data
        });
        
        console.error(`❌ ${test.name}:`, error.message);
      }
    }
    
    setResults(testResults);
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔧 AllenDataHub Debug Page</h1>
      <button 
        onClick={runTests}
        style={{ padding: '10px 20px', margin: '10px 0', fontSize: '16px' }}
      >
        Run Tests Again
      </button>
      
      <div style={{ marginTop: '20px' }}>
        {results.map((result, index) => (
          <div key={index} style={{ 
            border: '1px solid #ccc', 
            padding: '15px', 
            margin: '10px 0',
            borderRadius: '5px',
            background: result.status.includes('SUCCESS') ? '#e8f5e8' : '#ffe8e8'
          }}>
            <h3>{result.name}</h3>
            <p><strong>Status:</strong> {result.status}</p>
            <p><strong>HTTP Status:</strong> {result.statusCode}</p>
            {result.responseTime && <p><strong>Response Time:</strong> {result.responseTime}</p>}
            {result.error && <p><strong>Error:</strong> {result.error}</p>}
            {result.data && (
              <div>
                <p><strong>Response Data:</strong></p>
                <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '3px', overflow: 'auto' }}>
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DebugPage;
