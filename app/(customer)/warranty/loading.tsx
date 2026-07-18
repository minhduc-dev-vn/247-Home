import { Container } from '@/components/layout/container';
import { Loading } from '@/components/ui/loading';

export default function WarrantyLoading() {
  return (
    <main>
      <Container className="py-16">
        <Loading label="Đang tải thông tin bảo hành..." />
      </Container>
    </main>
  );
}
