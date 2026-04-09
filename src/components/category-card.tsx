import Link from "next/link";

type CategoryCardProps = {
  id: string;
  name: string;
  boxArtUrl: string;
};

export function CategoryCard({ id, name, boxArtUrl }: CategoryCardProps) {
  return (
    <Link href={`/category/${id}`} className="category-card">
      <img src={boxArtUrl} alt={name} className="category-art" />
      <div className="category-meta">
        <div className="eyebrow">Category</div>
        <h3>{name}</h3>
      </div>
    </Link>
  );
}

