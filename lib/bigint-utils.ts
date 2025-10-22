// Utilitário para converter BigInt para JSON
export function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value);
    }
    return converted;
  }
  
  return obj;
}

// Função para resposta JSON com conversão de BigInt
export function jsonResponseWithBigInt(data: any, status?: number) {
  const converted = convertBigIntToString(data);
  return new Response(JSON.stringify(converted), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
