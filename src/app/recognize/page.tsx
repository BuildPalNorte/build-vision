import { RecognitionWorkspace } from "@/components/recognition-workspace";
import { h1Class, pageClass } from "@/components/ui";

export default function RecognizePage() {
  return (
    <section className={pageClass}>
      <h1 className={h1Class}>Reconoce los rostros de tu foto</h1>
      <div className="mt-8">
        <RecognitionWorkspace />
      </div>
    </section>
  );
}
