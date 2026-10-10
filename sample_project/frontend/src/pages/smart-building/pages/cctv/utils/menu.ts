import {
  Bell,
  BrainCircuit,
  Car,
  Cpu,
  FileText,
  History,
  MapIcon,
  Search,
  UserCheck,
  Users,
  VideoIcon,
} from 'lucide-react';

export const CCTVMENU = [
  {
    id: 'live-view',
    label: 'Xem trực tiếp',
    icon: VideoIcon,
  },
  {
    id: 'map',
    label: 'Bản đồ khu vực',
    icon: MapIcon,
  },
  {
    id: 'playback',
    label: 'Xem lại',
    icon: History,
  },
  {
    id: 'event',
    label: 'Sự kiện & Cảnh báo',
    icon: Bell,
  },
  {
    id: 'ai-box',
    label: 'AI Box',
    icon: BrainCircuit,
    children: [
      { id: 'faces', label: 'Nhận diện khuôn mặt', icon: Users },
      { id: 'follow', label: 'Danh sách theo dõi', icon: UserCheck },
      { id: 'search', label: 'Tìm kiếm', icon: Search },
      { id: 'license-plate', label: 'Nhận diện biển số', icon: Car },
      // { id: 'count', label: 'Đếm người', icon: ChartColumn },
    ],
  },
  {
    id: 'device',
    label: 'Thiết bị & Tình trạng',
    icon: Cpu,
  },
  {
    id: 'report',
    label: 'Báo cáo & Xuất',
    icon: FileText,
  },
];
