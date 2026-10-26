import { FaceRegistration } from "@/components/face-registration";
import { h1Class, pageClass } from "@/components/ui";

export default function NewPersonPage() {
  return (
    <section className={pageClass}>
      <div className="mx-auto w-full max-w-[480px]">
        <h1 className={h1Class}>Registra un rostro</h1>
        <div className="mt-8">
          <FaceRegistration />
        </div>
      </div>
    </section>
  );
}
