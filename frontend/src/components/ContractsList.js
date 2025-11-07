import React, { useState, useEffect } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

function ContractsList() {
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    async function fetchContracts() {
      try {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.CONTRACTS), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch contracts');
        const data = await res.json();
        setContracts(data);
      } catch (err) {
        setError(err.message);
      }
    }
    fetchContracts();
  }, [token]);

  if (error) return <div>Error: {error}</div>;
  return (
    <div>
      <h2>Contracts</h2>
      <ul>
        {contracts.map(contract => (
          <li key={contract.contract_id}>
            {contract.contract_number} - {contract.customer_name} - {contract.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ContractsList;
