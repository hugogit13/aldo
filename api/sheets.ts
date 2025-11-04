import type { VercelRequest, VercelResponse } from '@vercel/node';

const SHEET_ID = '1-6D3ft-5hg-SfE_ptLmS1WOni2si73XgY9kSnBf--CM';
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

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

  try {
    // Fetch data from Google Sheets
    const sheetResponse = await fetch(GVIZ_URL);
    
    if (!sheetResponse.ok) {
      throw new Error(`Google Sheets API returned ${sheetResponse.status}`);
    }

    const text = await sheetResponse.text();

    // gviz returns JS like: google.visualization.Query.setResponse({...})
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const payload = JSON.parse(text.slice(jsonStart, jsonEnd));

    // Return the parsed data
    return response.status(200).json(payload);
  } catch (error) {
    console.error('Error fetching Google Sheets:', error);
    return response.status(500).json({ 
      error: 'Failed to fetch data from Google Sheets',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

