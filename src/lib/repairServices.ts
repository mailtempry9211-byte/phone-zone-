export interface RepairItem {
  id: string;
  icon: string;
  title: string;
  price: string;
  duration: string;
  description: string;
  active: boolean;
}

export const DEFAULT_REPAIR_SERVICES: RepairItem[] = [
  {
    id: "rep-1",
    icon: "📱",
    title: "Screen Replacement",
    price: "₹1,500",
    duration: "30–60 mins",
    description: "High-quality screen replacement with warranty",
    active: true,
  },
  {
    id: "rep-2",
    icon: "🔋",
    title: "Battery Replacement",
    price: "₹800",
    duration: "15–30 mins",
    description: "Original high-health battery with 6 months warranty",
    active: true,
  },
  {
    id: "rep-3",
    icon: "🔌",
    title: "Charging Port Repair",
    price: "₹600",
    duration: "20–45 mins",
    description: "Fix loose connection, slow charging, or mic issues",
    active: true,
  },
  {
    id: "rep-4",
    icon: "💻",
    title: "Software Issues",
    price: "₹300",
    duration: "30–90 mins",
    description: "OS flashing, bootloop recovery, and unlock issues",
    active: true,
  },
  {
    id: "rep-5",
    icon: "💧",
    title: "Water Damage Repair",
    price: "₹1,200",
    duration: "2–24 hours",
    description: "Deep ultrasonic cleaning and motherboard restoration",
    active: true,
  },
  {
    id: "rep-6",
    icon: "🔧",
    title: "General Repairs",
    price: "₹500",
    duration: "30–120 mins",
    description: "Camera, speaker, earpiece, sensor, or back glass",
    active: true,
  },
];
