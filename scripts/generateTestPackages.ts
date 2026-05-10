/**
 * Generate 30+ test packages payloads for manual copy/paste testing.
 *
 * Usage (in repo root):
 *   npx ts-node scripts/generateTestPackages.ts
 *
 * It prints JSON objects that you can feed to AddPackageScreen scanners,
 * or use in a temporary dev script that calls createPackage() locally.
 */

type TestPackagePayload = {
  ref_number: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_phone_2?: string;
  sender_name: string;
  sender_company?: string;
  sender_phone: string;
  date_of_arrive: string;
  supplement_info?: string;
  description?: string;
  weight?: string;
  gps_lat?: number;
  gps_lng?: number;
  limit_date?: string;
  price: number;
  is_paid: boolean;
};

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad2 = (n: number) => String(n).padStart(2, '0');

function randomPhone(prefix: string) {
  // 10 digits style e.g. 06 1234 5678, but as a string
  const a = randInt(1000, 9999);
  const b = randInt(1000, 9999);
  return `${prefix}${a}${b}`;
}

function randomDate(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`; // matches your UI placeholder format
}

const baseLat = 48.8566;
const baseLng = 2.3522;

const customers = [
  'kharoub',
  'el amrani',
  'tazi',
  'benali',
  'moulin',
  'dakhlaoui',
  'seddiki',
  'kassimi',
  'rachid',
  'amina',
  'youssef',
  'hassan',
];

const senders = ['si mo', 'azx', 'boutique paris', 'logi express', 'rayan store', 'midtown'];

function makePayload(i: number): TestPackagePayload {
  const isPaid = i % 3 === 0; // vary COD vs paid
  const price = isPaid ? 0 : randInt(10, 500);

  const lat = baseLat + (Math.random() - 0.5) * 0.15;
  const lng = baseLng + (Math.random() - 0.5) * 0.15;

  const customer = customers[i % customers.length];
  const sender = senders[i % senders.length];

  const dayOffset = randInt(-5, 5);
  const limitOffset = randInt(-2, 20);

  const dateOfArrive = randomDate(dayOffset);
  const limit_date = new Date(Date.now() + limitOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return {
    ref_number: `PKG-TEST-${Date.now()}-${i}`,
    customer_name: customer,
    customer_address: `${randInt(10, 99)}. av la fayete paris`,
    customer_phone: randomPhone('06'),
    customer_phone_2: i % 2 === 0 ? randomPhone('07') : undefined,
    sender_name: sender,
    sender_company: i % 2 === 0 ? 'azx' : undefined,
    sender_phone: randomPhone('06'),
    date_of_arrive: dateOfArrive,
    supplement_info: i % 4 === 0 ? 'tarbouche' : undefined,
    description: i % 5 === 0 ? 'fragile' : 'standard',
    weight: `${(Math.random() * 9 + 0.5).toFixed(1)}kg`,
    gps_lat: lat,
    gps_lng: lng,
    limit_date,
    price,
    is_paid: isPaid,
  };
}

const COUNT = 30;
const payloads: any[] = [];

for (let i = 0; i < COUNT; i++) {
  payloads.push(makePayload(i));
}

// Print as JSON array
console.log(JSON.stringify(payloads, null, 2));

