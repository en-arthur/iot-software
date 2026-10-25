import BoardDetail from "@/components/BoardDetail";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Board ${id}` };
}

export default async function BoardPage({ params }) {
  const { id } = await params;
  return <BoardDetail boardId={id} />;
}
