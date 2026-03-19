import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ status: 'unreachable' }));
  }, []);

  return (
    <div className="app">
      <h1>DocDime</h1>
      <p>Document management platform</p>
      {status && (
        <p className={`status ${status.status === 'ok' ? 'ok' : 'error'}`}>
          API: {status.status} | DB: {status.db ?? 'N/A'}
        </p>
      )}
    </div>
  );
}

export default App;
