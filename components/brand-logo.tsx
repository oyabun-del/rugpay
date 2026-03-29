import Image from 'next/image';
import Link from 'next/link';

type BrandLogoProps = {
  href?: string;
  size?: number;
  textClassName?: string;
  className?: string;
};

export function BrandLogo({
  href = '/',
  size = 36,
  textClassName = 'text-xl font-bold',
  className = 'flex items-center gap-2',
}: BrandLogoProps) {
  const content = (
    <>
      <Image
        src="/logo.png"
        alt="gameKover logo"
        width={size}
        height={size}
        className="rounded-md object-cover"
      />
      <span className={textClassName}>
        
        <span className="text-primary">Rug</span>
        Pay
      </span>
    </>
  );

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
