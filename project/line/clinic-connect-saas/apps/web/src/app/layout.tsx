import './globals.css';

export const metadata = {
  title: 'ClinicConnect - Admin Dashboard',
  description: 'ระบบจัดการคลินิกแบบ SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
