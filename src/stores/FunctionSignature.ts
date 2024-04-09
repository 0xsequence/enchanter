import { useState, useEffect } from 'react';

export interface FunctionSignature {
  id: number;
  text_signature: string;
  bytes_signature: string;
  hex_signature: string;
}

interface UseFunctionSignatureResult {
  signature: FunctionSignature | null;
  loading: boolean;
  error: string | null;
}

const useFunctionSignature = (hexString: string): UseFunctionSignatureResult => {
  const [signature, setSignature] = useState<FunctionSignature | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSignature = async () => {
      setLoading(true);
      setError(null);

      if (hexString.length !== 10) { // 4 bytes + '0x' prefix
        const errorMessage = 'Invalid hex string length. It should be 4 bytes long.';
        setError(errorMessage);
        setLoading(false);
        return;
      }

      const apiUrl = `https://www.4byte.directory/api/v1/signatures/?hex_signature=${hexString}`;
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data.results.length > 0) {
          setSignature(data.results[data.results.length - 1]);
        } else {
          const errorMessage = 'No signature found for the given hex string.';
          console.error(errorMessage);
          setError(errorMessage);
          setSignature(null);
        }
      } catch (error) {
        console.error('Error fetching the function signature:', error);
        setError('Error fetching the function signature');
        setSignature(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSignature();
  }, [hexString]);

  return { signature, loading, error };
};

export default useFunctionSignature;
