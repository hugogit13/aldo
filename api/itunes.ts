import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Enable CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Get the IDs from query parameter
  const ids = request.query.id;
  
  if (!ids || typeof ids !== 'string') {
    return response.status(400).json({ error: 'Missing or invalid id parameter' });
  }

  try {
    // Fetch data from iTunes API
    const itunesResponse = await fetch(`https://itunes.apple.com/lookup?id=${ids}`);
    
    if (!itunesResponse.ok) {
      throw new Error(`iTunes API returned ${itunesResponse.status}`);
    }

    const data = await itunesResponse.json();

    // Return the parsed data
    return response.status(200).json(data);
  } catch (error) {
    console.error('Error fetching iTunes API:', error);
    return response.status(500).json({ 
      error: 'Failed to fetch data from iTunes API',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

