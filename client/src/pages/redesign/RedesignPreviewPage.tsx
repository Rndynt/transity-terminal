import { useState } from "react";
import { Home, Settings, Bell, User, Search, Upload as UploadIcon } from "lucide-react";
import { Button, StatefulButton } from "@/components/motion/button";
import { Switch } from "@/components/motion/switch";
import { Checkbox } from "@/components/motion/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/motion/radio";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/motion/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/motion/tabs";
import { ExpandableTabs, type ExpandableTabsItem } from "@/components/motion/expandable-tabs";
import { Tooltip } from "@/components/motion/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/motion/popover";
import { Drawer } from "@/components/motion/drawer";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { CommandPalette, type CommandItem } from "@/components/motion/command-palette";
import {
  useAnimatedToastStack,
  AnimatedToastStack,
} from "@/components/motion/animated-toast-stack";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { NumberTicker } from "@/components/motion/number-ticker";
import { OTPInput } from "@/components/motion/otp-input";
import { RangeSlider } from "@/components/motion/range-slider";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { FileUpload } from "@/components/motion/file-upload";
import { WheelPicker } from "@/components/motion/wheel-picker";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
      </div>
      <div
        className="relative isolate flex min-h-[260px] flex-wrap items-center justify-center gap-6 p-8"
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function RedesignPreviewPage() {
  const [switchOn, setSwitchOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState("outlet-a");
  const [selectVal, setSelectVal] = useState("bus");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sliderVal, setSliderVal] = useState(60);
  const [buttonState, setButtonState] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [expandableTab, setExpandableTab] = useState<string | null>("home");

  const toastStack = useAnimatedToastStack();

  const expandableItems: ExpandableTabsItem[] = [
    {
      id: "home",
      label: "Home",
      icon: <Home className="h-4 w-4" />,
      content: (
        <div className="w-56 space-y-1 p-1 text-sm">
          <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted">
            <span>Trip hari ini</span>
            <span className="text-muted-foreground">12</span>
          </div>
          <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted">
            <span>Kursi terisi</span>
            <span className="text-muted-foreground">86%</span>
          </div>
        </div>
      ),
    },
    {
      id: "notif",
      label: "Notifikasi",
      icon: <Bell className="h-4 w-4" />,
      content: (
        <div className="w-56 space-y-1 p-1 text-sm">
          <div className="rounded-lg px-2 py-1.5 hover:bg-muted">Booking 2B baru masuk</div>
          <div className="rounded-lg px-2 py-1.5 hover:bg-muted">Refund #A102 disetujui</div>
        </div>
      ),
    },
    {
      id: "profile",
      label: "Profil",
      icon: <User className="h-4 w-4" />,
      content: (
        <div className="w-56 p-1 text-sm">
          <div className="rounded-lg px-2 py-1.5 hover:bg-muted">CSO User · Outlet Senen</div>
        </div>
      ),
    },
    {
      id: "settings",
      label: "Setting",
      icon: <Settings className="h-4 w-4" />,
      content: (
        <div className="w-56 p-1 text-sm">
          <div className="rounded-lg px-2 py-1.5 hover:bg-muted">Preferensi akun</div>
        </div>
      ),
    },
  ];

  const commandItems: CommandItem[] = [
    { id: "new-booking", label: "Buat booking baru", group: "CSO", onSelect: () => {} },
    { id: "goto-manifest", label: "Buka manifest", group: "Navigasi", onSelect: () => {} },
    { id: "goto-cargo", label: "Buka kargo", group: "Navigasi", onSelect: () => {} },
  ];

  const runStatefulDemo = () => {
    setButtonState("loading");
    setTimeout(() => setButtonState("success"), 1200);
    setTimeout(() => setButtonState("idle"), 2600);
  };

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-10">
      <div className="space-y-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Redesign preview
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">beUI Component Kit</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Komponen dari{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/starc007/ui-components"
            target="_blank"
            rel="noreferrer"
          >
            starc007/ui-components (beUI)
          </a>{" "}
          yang sudah dibawa masuk ke{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            client/src/components/motion
          </code>
          . Tiap kotak di bawah = satu component, live &amp; interaktif.
        </p>
      </div>

      <Section title="Buttons">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <StatefulButton state={buttonState} onClick={runStatefulDemo} loadingText="Memproses...">
          Konfirmasi Booking
        </StatefulButton>
      </Section>

      <Section title="Form controls">
        <Switch checked={switchOn} onCheckedChange={setSwitchOn} label="Auto-confirm" />
        <Checkbox checked={checked} onCheckedChange={setChecked} label="Kirim notifikasi WA" />
        <RadioGroup value={radio} onValueChange={setRadio} orientation="horizontal">
          <RadioGroupItem value="outlet-a" label="Outlet A" />
          <RadioGroupItem value="outlet-b" label="Outlet B" />
        </RadioGroup>
      </Section>

      <Section title="Input & Select">
        <Input placeholder="Nama penumpang" className="w-56" />
        <Input placeholder="Email tervalidasi" success className="w-56" />
        <Select value={selectVal} onValueChange={setSelectVal}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Pilih moda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bus">Bus</SelectItem>
            <SelectItem value="shuttle">Shuttle</SelectItem>
            <SelectItem value="cargo">Cargo</SelectItem>
          </SelectContent>
        </Select>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="jadwal" variant="pill" className="w-full">
          <TabsList>
            <TabsTrigger value="jadwal">Jadwal</TabsTrigger>
            <TabsTrigger value="kursi">Kursi</TabsTrigger>
            <TabsTrigger value="bayar">Bayar</TabsTrigger>
          </TabsList>
          <TabsContent value="jadwal">Pilih rute & jam keberangkatan.</TabsContent>
          <TabsContent value="kursi">Pilih kursi penumpang.</TabsContent>
          <TabsContent value="bayar">Metode pembayaran.</TabsContent>
        </Tabs>
      </Section>

      <Section title="Expandable Tabs">
        <ExpandableTabs items={expandableItems} value={expandableTab} onValueChange={setExpandableTab} />
      </Section>

      <Section title="Tooltip & Popover">
        <Tooltip content="Total kursi tersedia">
          <Button variant="outline" size="sm">
            Hover saya
          </Button>
        </Tooltip>
        <Popover>
          <PopoverTrigger>
            <Button variant="outline" size="sm">
              <Search className="mr-1.5 h-4 w-4" /> Klik saya
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 text-sm">
            Popover morph — cocok untuk quick filter atau aksi cepat di CSO.
          </PopoverContent>
        </Popover>
      </Section>

      <Section title="Drawer, Bottom Sheet & Command Palette">
        <Button variant="outline" onClick={() => setDrawerOpen(true)}>
          Buka Drawer
        </Button>
        <Button variant="outline" onClick={() => setSheetOpen(true)}>
          Buka Bottom Sheet
        </Button>
        <Button variant="outline" onClick={() => setPaletteOpen(true)}>
          Buka Command Palette (⌘K)
        </Button>
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} side="right" ariaLabel="Detail trip">
          <div className="flex h-full flex-col gap-3 p-5">
            <h3 className="text-lg font-semibold">Detail Trip</h3>
            <p className="text-sm text-muted-foreground">
              Panel drawer dari beUI, dipakai untuk detail trip / booking tanpa pindah halaman.
            </p>
          </div>
        </Drawer>
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Ringkasan Booking"
          description="Contoh bottom sheet untuk mobile CSO."
        >
          <div className="p-5 text-sm text-muted-foreground">
            Cocok untuk aksi cepat di layar HP: konfirmasi kursi, ringkasan bayar, dll.
          </div>
        </BottomSheet>
        <CommandPalette items={commandItems} open={paletteOpen} onOpenChange={setPaletteOpen} />
      </Section>

      <Section title="Badges, Toast & OTP">
        <AnimatedBadge status="success">Lunas</AnimatedBadge>
        <AnimatedBadge status="warning">Pending</AnimatedBadge>
        <AnimatedBadge status="danger">Batal</AnimatedBadge>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toastStack.showToast({
              title: "Booking terkonfirmasi",
              description: "Kursi 2B berhasil dibayar.",
              status: "success",
            })
          }
        >
          Trigger Toast
        </Button>
        <OTPInput length={4} label="Verifikasi No. HP" />
      </Section>

      <Section title="Number Ticker & Range Slider">
        <NumberTicker value={128500000} prefix="Rp " locale className="text-2xl font-bold" />
        <div className="w-64">
          <RangeSlider value={sliderVal} onValueChange={setSliderVal} showTicks />
          <p className="mt-1 text-xs text-muted-foreground">Kapasitas terisi: {sliderVal}%</p>
        </div>
      </Section>

      <Section title="Accordion & File Upload">
        <div className="w-full max-w-md">
          <BouncyAccordion
            items={[
              { id: "faq-1", title: "Bagaimana cara reschedule?", description: "Buka detail booking, pilih ubah jadwal." },
              { id: "faq-2", title: "Refund berapa lama?", description: "Refund diproses 1-3 hari kerja." },
            ]}
          />
        </div>
        <div className="w-full max-w-md">
          <FileUpload
            title="Upload bukti transfer"
            description="PNG/JPG, maks 5MB"
            browseLabel="Pilih file"
          />
        </div>
      </Section>

      <Section title="Wheel Picker">
        <WheelPicker
          options={["06:00", "07:00", "08:00", "09:00", "10:00", "11:00"]}
          defaultValue="07:00"
          aria-label="Jam keberangkatan"
        />
      </Section>

      <AnimatedToastStack toasts={toastStack.toasts} onDismiss={toastStack.dismissToast} fixed />
    </div>
    </div>
  );
}
