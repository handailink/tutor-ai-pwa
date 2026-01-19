import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-payroll-token',
};

const SHEET_HEADERS = [
  'month',
  'tutor_id',
  'tutor_name',
  'total_lessons',
  'total_minutes',
  'hourly_yen',
  'total_pay_yen',
  'generated_at',
];

const requireEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`${key} が設定されていません`);
  }
  return value;
};

const toBase64Url = (input: string | Uint8Array): string => {
  const base64 = typeof input === 'string'
    ? btoa(input)
    : encodeBase64(input);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const getAccessToken = async (
  serviceAccountEmail: string,
  privateKey: string,
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claimSet))}`;

  const keyData = pemToArrayBuffer(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  const signedJwt = `${unsignedToken}.${toBase64Url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Google OAuth エラー: ${tokenResponse.status} ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token as string;
};

const formatMonth = (year: number, month: number): string => {
  const monthText = String(month).padStart(2, '0');
  return `${year}-${monthText}`;
};

const formatDate = (year: number, month: number, day: number): string => {
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
};

const formatJstDateTime = (): string => {
  const jstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  const hour = String(jstDate.getUTCHours()).padStart(2, '0');
  const minute = String(jstDate.getUTCMinutes()).padStart(2, '0');
  const second = String(jstDate.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
};

const getPreviousMonthRange = (): { monthLabel: string; startDate: string; endDate: string } => {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  let year = jstNow.getUTCFullYear();
  let month = jstNow.getUTCMonth() + 1;
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    monthLabel: formatMonth(year, month),
    startDate: formatDate(year, month, 1),
    endDate: formatDate(year, month, endDay),
  };
};

const getSheetValues = async (
  accessToken: string,
  sheetId: string,
  sheetName: string,
): Promise<string[][]> => {
  const range = `${sheetName}!A:H`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sheets 読み込みエラー: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return (data.values ?? []) as string[][];
};

const ensureSheetHeader = async (
  accessToken: string,
  sheetId: string,
  sheetName: string,
  currentValues: string[][],
): Promise<void> => {
  const existingHeader = currentValues[0];
  const headerMismatch = !existingHeader || SHEET_HEADERS.some((header, index) => existingHeader[index] !== header);

  if (!headerMismatch) {
    return;
  }

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${sheetName}!A1:H1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [SHEET_HEADERS] }),
  });
};

type PayrollRow = {
  tutor_id: string;
  tutor_name: string;
  total_lessons: number;
  total_minutes: number;
  hourly_yen: number;
  total_pay_yen: number;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const token = requireEnv('PAYROLL_EXPORT_TOKEN');
    const requestToken = req.headers.get('x-payroll-token');
    if (requestToken !== token) {
      return new Response(JSON.stringify({ error: '認証に失敗しました' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { monthLabel, startDate, endDate } = getPreviousMonthRange();

    const { data, error } = await supabase.rpc('calculate_monthly_tutor_payroll', {
      start_date: startDate,
      end_date: endDate,
    });

    if (error) {
      throw new Error(`集計エラー: ${error.message}`);
    }

    const payrollRows = (data ?? []) as PayrollRow[];

    const serviceAccountEmail = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKeyRaw = requireEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    const sheetId = requireEnv('GOOGLE_SHEET_ID');
    const sheetName = Deno.env.get('GOOGLE_SHEET_NAME') ?? 'Sheet1';

    const accessToken = await getAccessToken(serviceAccountEmail, privateKey);
    const values = await getSheetValues(accessToken, sheetId, sheetName);
    await ensureSheetHeader(accessToken, sheetId, sheetName, values);

    const existingMap = new Map<string, number>();
    values.slice(1).forEach((row, index) => {
      const month = row[0];
      const tutorId = row[1];
      if (!month || !tutorId) {
        return;
      }
      existingMap.set(`${month}__${tutorId}`, index + 2);
    });

    const generatedAt = formatJstDateTime();
    const updates: Array<{ range: string; values: (string | number)[][] }> = [];
    const appends: (string | number)[][] = [];

    payrollRows.forEach((row) => {
      const key = `${monthLabel}__${row.tutor_id}`;
      const rowValues = [
        monthLabel,
        row.tutor_id,
        row.tutor_name,
        row.total_lessons ?? 0,
        row.total_minutes ?? 0,
        row.hourly_yen ?? 0,
        row.total_pay_yen ?? 0,
        generatedAt,
      ];

      const rowIndex = existingMap.get(key);
      if (rowIndex) {
        updates.push({
          range: `${sheetName}!A${rowIndex}:H${rowIndex}`,
          values: [rowValues],
        });
      } else {
        appends.push(rowValues);
      }
    });

    if (updates.length > 0) {
      const batchUpdateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: updates,
          }),
        },
      );

      if (!batchUpdateResponse.ok) {
        const errorText = await batchUpdateResponse.text();
        throw new Error(`Sheets 更新エラー: ${batchUpdateResponse.status} ${errorText}`);
      }
    }

    if (appends.length > 0) {
      const appendResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${sheetName}!A:H`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: appends,
          }),
        },
      );

      if (!appendResponse.ok) {
        const errorText = await appendResponse.text();
        throw new Error(`Sheets 追記エラー: ${appendResponse.status} ${errorText}`);
      }
    }

    return new Response(
      JSON.stringify({
        month: monthLabel,
        total_rows: payrollRows.length,
        updated_rows: updates.length,
        appended_rows: appends.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
