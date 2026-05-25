import { POST as uploadProductsCsvPOST } from '../upload-products-csv/route';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return uploadProductsCsvPOST(request);
}
