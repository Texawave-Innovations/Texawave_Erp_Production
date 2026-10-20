// Phase 12b — SCM Master Data. A read-only, searchable reference screen over the genuine SCM
// master collections (Products, Vendors, Customers, Warehouses, Locations, Batches, Serials,
// Carriers) — every one of them already CRUD-managed on its own existing SCM/Sales page. This
// page never duplicates that CRUD; it exists purely so anyone working an SCM workflow can look
// a master record up in one place. Reference data with no dedicated master collection of its own
// (categories/UOM/payment terms/GST live only as string-array config under `/master/sales`;
// employees live under `/hr/employees`) is a link-out card, never a fabricated tab.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { Database, Search, ExternalLink } from "lucide-react";
import { useScmMasterData } from "./useScmMasterData";
import {
  searchBatches,
  searchCarriers,
  searchCustomers,
  searchLocations,
  searchProducts,
  searchSerials,
  searchVendors,
  searchWarehouses,
} from "./scmMasterDataService";

export default function ScmMasterData() {
  const navigate = useNavigate();
  const { loading, data } = useScmMasterData();
  const [q, setQ] = useState("");

  const products = useMemo(
    () => searchProducts(data.products, q, 200),
    [data.products, q],
  );
  const vendors = useMemo(
    () => searchVendors(data.vendors, q, 200),
    [data.vendors, q],
  );
  const customers = useMemo(
    () => searchCustomers(data.customers, q, 200),
    [data.customers, q],
  );
  const warehouses = useMemo(
    () => searchWarehouses(data.warehouses, q, 200),
    [data.warehouses, q],
  );
  const locations = useMemo(
    () => searchLocations(data.locations, q, 200),
    [data.locations, q],
  );
  const batches = useMemo(
    () => searchBatches(data.batches, q, 200),
    [data.batches, q],
  );
  const serials = useMemo(
    () => searchSerials(data.serials, q, 200),
    [data.serials, q],
  );
  const carriers = useMemo(
    () => searchCarriers(data.carriers, q, 200),
    [data.carriers, q],
  );

  const warehouseName = (id: string) =>
    data.warehouses.find((w) => w.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Database className="h-6 w-6 text-brand-600" /> Master Data
        </h2>
        <p className="text-muted-foreground mt-1">
          Read-only lookup across every SCM master record — products, vendors,
          customers, warehouses, locations, batches, serials and carriers.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search across all master data..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="products">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="products">
                Products ({products.length})
              </TabsTrigger>
              <TabsTrigger value="vendors">
                Vendors ({vendors.length})
              </TabsTrigger>
              <TabsTrigger value="customers">
                Customers ({customers.length})
              </TabsTrigger>
              <TabsTrigger value="warehouses">
                Warehouses ({warehouses.length})
              </TabsTrigger>
              <TabsTrigger value="locations">
                Locations ({locations.length})
              </TabsTrigger>
              <TabsTrigger value="batches">
                Batches ({batches.length})
              </TabsTrigger>
              <TabsTrigger value="serials">
                Serials ({serials.length})
              </TabsTrigger>
              <TabsTrigger value="carriers">
                Carriers ({carriers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>UOM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <EmptyRow cols={4} text="Loading..." />
                  ) : products.length === 0 ? (
                    <EmptyRow cols={4} text="No products found." />
                  ) : (
                    products.map((p) => (
                      <TableRow
                        key={p.productCode}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.productCode}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.category || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.uom}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="vendors">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <EmptyRow cols={4} text="Loading..." />
                  ) : vendors.length === 0 ? (
                    <EmptyRow cols={4} text="No vendors found." />
                  ) : (
                    vendors.map((v) => (
                      <TableRow
                        key={v.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate("/scm/suppliers")}
                      >
                        <TableCell className="font-medium">
                          {v.companyName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {v.vendorCode}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.contactPerson}
                        </TableCell>
                        <TableCell>
                          {v.status && (
                            <Badge variant="outline">{v.status}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="customers">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>GST</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <EmptyRow cols={4} text="Loading..." />
                  ) : customers.length === 0 ? (
                    <EmptyRow cols={4} text="No customers found." />
                  ) : (
                    customers.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {c.companyName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.customerCode}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.contactPerson}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.gst || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="warehouses">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <EmptyRow cols={4} text="Loading..." />
                  ) : warehouses.length === 0 ? (
                    <EmptyRow cols={4} text="No warehouses found." />
                  ) : (
                    warehouses.map((w) => (
                      <TableRow
                        key={w.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate("/scm/warehouse/warehouses")}
                      >
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {w.code}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {w.type}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              w.status === "Active"
                                ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                                : "text-muted-foreground"
                            }
                          >
                            {w.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="locations">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location Code</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <EmptyRow cols={4} text="Loading..." />
                  ) : locations.length === 0 ? (
                    <EmptyRow cols={4} text="No locations found." />
                  ) : (
                    locations.map((l) => (
                      <TableRow
                        key={l.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate("/scm/warehouse/locations")}
                      >
                        <TableCell className="font-mono text-xs">
                          {l.locationCode || l.binCode}
                        </TableCell>
                        <TableCell className="text-sm">
                          {warehouseName(l.warehouseId)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.locationType || "BIN"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              l.status === "Active"
                                ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                                : "text-muted-foreground"
                            }
                          >
                            {l.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="batches">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <EmptyRow cols={4} text="Loading..." />
                  ) : batches.length === 0 ? (
                    <EmptyRow cols={4} text="No batches found." />
                  ) : (
                    batches.map((b) => (
                      <TableRow
                        key={b.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate("/scm/inventory/batches")}
                      >
                        <TableCell className="font-mono text-xs">
                          {b.batchNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {b.productName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {warehouseName(b.warehouseId)}
                        </TableCell>
                        <TableCell className="text-sm">{b.quantity}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="serials">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <EmptyRow cols={4} text="Loading..." />
                  ) : serials.length === 0 ? (
                    <EmptyRow cols={4} text="No serial numbers found." />
                  ) : (
                    serials.map((s) => (
                      <TableRow
                        key={s.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate("/scm/inventory/serials")}
                      >
                        <TableCell className="font-mono text-xs">
                          {s.serialNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.productName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {warehouseName(s.warehouseId)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="carriers">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <EmptyRow cols={3} text="Loading..." />
                  ) : carriers.length === 0 ? (
                    <EmptyRow cols={3} text="No carriers found." />
                  ) : (
                    carriers.map((c) => (
                      <TableRow
                        key={c.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate("/scm/logistics/carriers")}
                      >
                        <TableCell className="font-medium">
                          {c.carrierName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.carrierCode}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="font-semibold">Other Reference Data</div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="border rounded-md p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">
                Categories, UOM, Payment Terms, GST %
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Maintained centrally under Sales Master — not a separate SCM
                master collection.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate("/master/sales", {
                  state: {
                    from: "/scm/master-data",
                    fromLabel: "SCM Master Data",
                  },
                })
              }
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open
            </Button>
          </div>
          <div className="border rounded-md p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">Employees</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Maintained centrally under HR — SCM only records the logged-in
                user on transactions.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate("/hr/employees", {
                  state: {
                    from: "/scm/master-data",
                    fromLabel: "SCM Master Data",
                  },
                })
              }
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={cols}
        className="text-center py-10 text-muted-foreground"
      >
        {text}
      </TableCell>
    </TableRow>
  );
}
