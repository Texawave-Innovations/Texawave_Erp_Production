// Master data for the SCM demo seed (see `demoSeedService.ts`). Everything here is fictional —
// company names, GSTINs, phone numbers and e-mail addresses (reserved `.example` domain) are
// placeholders for a sales demo, not real parties.
import type {
  ScmQualityDefectCategory,
  ScmQualityDefectSeverity,
  ScmQualityInspectionType,
  ShipmentServiceType,
  VendorStatus,
  WarehouseType,
} from "@/types";

/** People the seeded audit trail is attributed to, so the activity logs read like a real team. */
export const PERSONA = {
  procurement: "Priya Raman",
  approver: "Rajesh Iyer",
  warehouse: "Arun Kumar",
  inventory: "Suresh Babu",
  quality: "Meena Sundaram",
  logistics: "Vignesh Rao",
  sales: "Divya Menon",
} as const;

export interface DemoProduct {
  code: string;
  name: string;
  category: string;
  uom: string;
  sellPrice: number;
  costPrice: number;
  reorderLevel: number;
  minimumStock: number;
  maximumStock: number;
  batchTracked?: boolean;
  serialTracked?: boolean;
}

export const PRODUCTS = {
  bearing: {
    code: "BRG-6205ZZ",
    name: "Deep Groove Ball Bearing 6205-ZZ",
    category: "Bearings",
    uom: "PCS",
    sellPrice: 260,
    costPrice: 185,
    reorderLevel: 150,
    minimumStock: 100,
    maximumStock: 2000,
  },
  valve: {
    code: "VLV-HCV12",
    name: "Hydraulic Control Valve 12 mm",
    category: "Hydraulics",
    uom: "PCS",
    sellPrice: 3450,
    costPrice: 2400,
    reorderLevel: 20,
    minimumStock: 10,
    maximumStock: 150,
  },
  motor: {
    code: "MTR-IND2HP",
    name: "Induction Motor 2 HP (3-Phase)",
    category: "Motors",
    uom: "PCS",
    sellPrice: 13500,
    costPrice: 9800,
    reorderLevel: 2,
    minimumStock: 1,
    maximumStock: 10,
    serialTracked: true,
  },
  cable: {
    code: "CBL-CU4SQ",
    name: "Copper Power Cable 4 sq.mm",
    category: "Electricals",
    uom: "MTR",
    sellPrice: 58,
    costPrice: 42,
    reorderLevel: 500,
    minimumStock: 300,
    maximumStock: 5000,
    batchTracked: true,
  },
  housing: {
    code: "HSG-ADC350",
    name: "Aluminium Die-Cast Gear Housing ADC-350",
    category: "Castings",
    uom: "PCS",
    sellPrice: 920,
    costPrice: 640,
    reorderLevel: 100,
    minimumStock: 50,
    maximumStock: 1000,
  },
  gloves: {
    code: "GLV-NIT09",
    name: "Nitrile Safety Gloves (Box of 100)",
    category: "Safety",
    uom: "BOX",
    sellPrice: 420,
    costPrice: 310,
    reorderLevel: 30,
    minimumStock: 20,
    maximumStock: 300,
  },
  seal: {
    code: "SEAL-OR25K",
    name: "O-Ring Seal Kit (25 pcs)",
    category: "Hydraulics",
    uom: "KIT",
    sellPrice: 140,
    costPrice: 95,
    reorderLevel: 50,
    minimumStock: 30,
    maximumStock: 400,
  },
  pump: {
    code: "PMP-CF1HP",
    name: "Centrifugal Water Pump 1 HP",
    category: "Pumps",
    uom: "PCS",
    sellPrice: 10900,
    costPrice: 7800,
    reorderLevel: 4,
    minimumStock: 2,
    maximumStock: 20,
  },
} satisfies Record<string, DemoProduct>;

export type ProductKey = keyof typeof PRODUCTS;

export interface DemoWarehouse {
  code: string;
  name: string;
  type: WarehouseType;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  managerName: string;
  phone: string;
  capacity: number;
}

export const WAREHOUSES = {
  chennai: {
    code: "WH-CHN",
    name: "Chennai Central Warehouse",
    type: "Main",
    address: "Plot 14, SIPCOT Industrial Park, Irungattukottai",
    city: "Chennai",
    state: "Tamil Nadu",
    postalCode: "602117",
    managerName: "Arun Kumar",
    phone: "+91 98400 11223",
    capacity: 12000,
  },
  bengaluru: {
    code: "WH-BLR",
    name: "Bengaluru Distribution Centre",
    type: "Distribution",
    address: "No. 82, Peenya Industrial Area Phase II",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560058",
    managerName: "Kiran Gowda",
    phone: "+91 98450 44556",
    capacity: 5000,
  },
} satisfies Record<string, DemoWarehouse>;

export type WarehouseKey = keyof typeof WAREHOUSES;

/** Bin layout per warehouse: zone → rack → shelf → bins. `capacity` is in units. */
export const LOCATION_LAYOUT: Record<
  WarehouseKey,
  Array<{
    zone: string;
    zoneName: string;
    racks: Array<{
      rack: string;
      shelves: Array<{
        shelf: string;
        bins: Array<{ bin: string; name: string; capacity: number }>;
      }>;
    }>;
  }>
> = {
  chennai: [
    {
      zone: "Z01",
      zoneName: "Fast-moving Components",
      racks: [
        {
          rack: "R01",
          shelves: [
            {
              shelf: "S01",
              bins: [
                { bin: "B01", name: "Bearings — primary", capacity: 500 },
                { bin: "B02", name: "Bearings — overflow", capacity: 800 },
              ],
            },
            {
              shelf: "S02",
              bins: [
                { bin: "B03", name: "Valves & seals", capacity: 300 },
                { bin: "B04", name: "Motors (floor pallet)", capacity: 20 },
              ],
            },
          ],
        },
      ],
    },
    {
      zone: "Z02",
      zoneName: "Bulk & Electricals",
      racks: [
        {
          rack: "R01",
          shelves: [
            {
              shelf: "S01",
              bins: [
                { bin: "B01", name: "Cable drums", capacity: 4000 },
                { bin: "B02", name: "Castings", capacity: 600 },
              ],
            },
          ],
        },
      ],
    },
  ],
  bengaluru: [
    {
      zone: "Z01",
      zoneName: "Distribution Stock",
      racks: [
        {
          rack: "R01",
          shelves: [
            {
              shelf: "S01",
              bins: [
                { bin: "B01", name: "Bearings", capacity: 600 },
                { bin: "B02", name: "General", capacity: 400 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export interface DemoVendor {
  code: string;
  companyName: string;
  type: string;
  status: VendorStatus;
  gst: string;
  pan: string;
  contactPerson: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  paymentTerms: string;
  creditLimit: number;
  leadTimeDays: number;
  rating: number;
  notes: string;
}

export const VENDORS = {
  precision: {
    code: "SUP-PBI",
    companyName: "Precision Bearings India Pvt Ltd",
    type: "Manufacturer",
    status: "Active",
    gst: "33AAECP4821K1Z6",
    pan: "AAECP4821K",
    contactPerson: "Ramesh Natarajan",
    phone: "+91 94440 12345",
    email: "sales@precisionbearings.example",
    street: "21, Ambattur Industrial Estate",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600058",
    paymentTerms: "Net 30",
    creditLimit: 1500000,
    leadTimeDays: 10,
    rating: 5,
    notes: "Preferred bearing supplier. ISO 9001 certified.",
  },
  hydrotech: {
    code: "SUP-HFS",
    companyName: "Hydrotech Fluid Systems",
    type: "Manufacturer",
    status: "Active",
    gst: "33AAGFH7314M1Z2",
    pan: "AAGFH7314M",
    contactPerson: "Lakshmi Prasad",
    phone: "+91 94890 23456",
    email: "orders@hydrotech.example",
    street: "SF 112, Kurichi Industrial Cluster",
    city: "Coimbatore",
    state: "Tamil Nadu",
    pincode: "641021",
    paymentTerms: "Net 45",
    creditLimit: 2000000,
    leadTimeDays: 7,
    rating: 4,
    notes: "Valves, seals and motors.",
  },
  southern: {
    code: "SUP-SCW",
    companyName: "Southern Cables & Wires",
    type: "Manufacturer",
    status: "Active",
    gst: "33AAHFS5566Q1Z9",
    pan: "AAHFS5566Q",
    contactPerson: "Senthil Murugan",
    phone: "+91 94430 34567",
    email: "dispatch@southerncables.example",
    street: "Plot 7, SIPCOT Phase I",
    city: "Hosur",
    state: "Tamil Nadu",
    pincode: "635126",
    paymentTerms: "Net 30",
    creditLimit: 1000000,
    leadTimeDays: 8,
    rating: 3,
    notes:
      "Price-competitive on copper cable; recent insulation quality issues under review.",
  },
  metro: {
    code: "SUP-MIS",
    companyName: "Metro Industrial Supplies",
    type: "Distributor",
    status: "Active",
    gst: "29AAJCM9087R1Z4",
    pan: "AAJCM9087R",
    contactPerson: "Farhan Sheikh",
    phone: "+91 98860 45678",
    email: "info@metroindustrial.example",
    street: "44, Bommasandra Industrial Area",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560099",
    paymentTerms: "Net 30",
    creditLimit: 1200000,
    leadTimeDays: 14,
    rating: 3,
    notes: "Multi-category distributor — castings, consumables and cable.",
  },
  nova: {
    code: "SUP-NCL",
    companyName: "Nova Castings Ltd",
    type: "Manufacturer",
    status: "Pending Approval",
    gst: "27AAKCN2231P1Z7",
    pan: "AAKCN2231P",
    contactPerson: "Aditi Kulkarni",
    phone: "+91 98220 56789",
    email: "bd@novacastings.example",
    street: "Gat No. 112, Chakan MIDC",
    city: "Pune",
    state: "Maharashtra",
    pincode: "410501",
    paymentTerms: "Net 60",
    creditLimit: 0,
    leadTimeDays: 21,
    rating: 0,
    notes:
      "New casting vendor — onboarding documents under review. Cannot receive RFQs/POs until approved.",
  },
} satisfies Record<string, DemoVendor>;

export type VendorKey = keyof typeof VENDORS;

export interface DemoCustomer {
  code: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gst: string;
  pan: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

export const CUSTOMERS = {
  balaji: {
    code: "CUS-SBE",
    companyName: "Sri Balaji Engineering Works",
    contactPerson: "Venkatesh Rao",
    email: "purchase@sribalaji.example",
    phone: "+91 98410 61234",
    gst: "33AAFFS3344D1Z1",
    pan: "AAFFS3344D",
    street: "18, Guindy Industrial Estate",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600032",
  },
  apex: {
    code: "CUS-AAC",
    companyName: "Apex Automotive Components Pvt Ltd",
    contactPerson: "Neha Deshpande",
    email: "scm@apexauto.example",
    phone: "+91 98230 72345",
    gst: "27AAHCA6677E1Z3",
    pan: "AAHCA6677E",
    street: "Plot B-12, Bhosari MIDC",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411026",
  },
  kaveri: {
    code: "CUS-KAI",
    companyName: "Kaveri Agro Industries",
    contactPerson: "Murali Krishnan",
    email: "stores@kaveriagro.example",
    phone: "+91 94430 83456",
    gst: "33AAJFK8899F1Z5",
    pan: "AAJFK8899F",
    street: "5/210, Avinashi Road",
    city: "Coimbatore",
    state: "Tamil Nadu",
    pincode: "641014",
  },
  deccan: {
    code: "CUS-DPM",
    companyName: "Deccan Pumps & Motors",
    contactPerson: "Srinivas Reddy",
    email: "procurement@deccanpumps.example",
    phone: "+91 99080 94567",
    gst: "36AAKFD1122G1Z8",
    pan: "AAKFD1122G",
    street: "IDA Cherlapally, Phase III",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500051",
  },
} satisfies Record<string, DemoCustomer>;

export type CustomerKey = keyof typeof CUSTOMERS;

export const CARRIERS: Array<{
  code: string;
  name: string;
  serviceTypes: ShipmentServiceType[];
  contact: string;
  phone: string;
  email: string;
  notes: string;
}> = [
  {
    code: "BLUEDART",
    name: "Blue Dart Express",
    serviceTypes: ["EXPRESS", "STANDARD", "SAME_DAY"],
    contact: "Key Accounts Desk",
    phone: "+91 44 4000 1111",
    email: "keyaccounts@bluedart.example",
    notes: "Express parcels up to 50 kg.",
  },
  {
    code: "DELHIVERY",
    name: "Delhivery",
    serviceTypes: ["STANDARD", "ECONOMY"],
    contact: "B2B Support",
    phone: "+91 124 400 2222",
    email: "b2b@delhivery.example",
    notes: "Pan-India surface freight.",
  },
  {
    code: "VRL",
    name: "VRL Logistics",
    serviceTypes: ["ECONOMY", "STANDARD"],
    contact: "Chennai Branch",
    phone: "+91 44 4000 3333",
    email: "chennai@vrl.example",
    notes: "Full/part truck loads, cable drums and pallets.",
  },
];

export const DEFECTS: Array<{
  code: string;
  name: string;
  description: string;
  category: ScmQualityDefectCategory;
  severity: ScmQualityDefectSeverity;
}> = [
  {
    code: "INS-CRACK",
    name: "Insulation crack",
    description: "Visible cracks or cuts in cable insulation",
    category: "PRODUCT",
    severity: "HIGH",
  },
  {
    code: "DIM-OOT",
    name: "Dimension out of tolerance",
    description: "Critical dimension outside drawing tolerance",
    category: "PRODUCT",
    severity: "MEDIUM",
  },
  {
    code: "SURF-POR",
    name: "Surface porosity",
    description: "Blow holes / porosity on casting surface",
    category: "PHYSICAL_DAMAGE",
    severity: "HIGH",
  },
  {
    code: "PKG-DMG",
    name: "Packaging damaged",
    description: "Outer carton or pallet damaged in transit",
    category: "PACKAGING",
    severity: "LOW",
  },
  {
    code: "SHORT-QTY",
    name: "Short supply",
    description: "Quantity received is less than invoiced",
    category: "QUANTITY",
    severity: "MEDIUM",
  },
  {
    code: "NOISE-VIB",
    name: "Abnormal noise / vibration",
    description: "Bearing or motor runs rough on spin test",
    category: "FUNCTIONAL",
    severity: "CRITICAL",
  },
];

export const TEMPLATES: Array<{
  code: string;
  name: string;
  description: string;
  inspectionType: ScmQualityInspectionType;
  checkpoints: Array<{
    name: string;
    description?: string;
    required: boolean;
    expectedValue?: string;
    unit?: string;
    sequence: number;
  }>;
}> = [
  {
    code: "TPL-INC-GEN",
    name: "Incoming Material Inspection",
    description: "Standard receiving inspection for all purchased material",
    inspectionType: "INCOMING",
    checkpoints: [
      { name: "Packaging intact", required: true, sequence: 1 },
      {
        name: "Quantity matches delivery challan",
        required: true,
        sequence: 2,
      },
      { name: "Visual inspection", required: true, sequence: 3 },
      {
        name: "Critical dimension check",
        required: false,
        expectedValue: "Per drawing",
        unit: "mm",
        sequence: 4,
      },
    ],
  },
  {
    code: "TPL-RET-CUS",
    name: "Customer Return Inspection",
    description: "Condition and function check for returned goods",
    inspectionType: "CUSTOMER_RETURN",
    checkpoints: [
      { name: "Physical condition", required: true, sequence: 1 },
      { name: "Functional / spin test", required: false, sequence: 2 },
    ],
  },
  {
    code: "TPL-INV-AUD",
    name: "Periodic Stock Quality Audit",
    description: "Random quality audit of stock on hand",
    inspectionType: "INVENTORY",
    checkpoints: [
      { name: "Visual inspection", required: true, sequence: 1 },
      { name: "Surface porosity check", required: true, sequence: 2 },
    ],
  },
  {
    code: "TPL-PDI",
    name: "Pre-Dispatch Inspection",
    description: "Final check before goods leave the warehouse",
    inspectionType: "PRE_DISPATCH",
    checkpoints: [
      {
        name: "Labelling and part numbers correct",
        required: true,
        sequence: 1,
      },
      { name: "Packing secure", required: true, sequence: 2 },
    ],
  },
];
