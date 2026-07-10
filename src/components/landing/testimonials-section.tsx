import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PublicTestimonial } from "@/lib/public-data";

type TestimonialsSectionProps = {
  testimonials: PublicTestimonial[];
};

type DisplayTestimonial = {
  id: string;
  rating: number;
  quote: string;
  name: string;
  clinic: string;
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={
            i < rating
              ? "h-4 w-4 fill-fin text-fin"
              : "h-4 w-4 text-inverse-foreground/30"
          }
        />
      ))}
    </div>
  );
}

export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const t = useTranslations("landing.testimonials");

  const fallback = (
    t.raw("fallback") as { quote: string; name: string; clinic: string }[]
  ).map((item, index) => ({
    id: `fallback-${index}`,
    rating: 5,
    quote: item.quote,
    name: item.name,
    clinic: item.clinic,
  }));

  const items: DisplayTestimonial[] =
    testimonials.length > 0
      ? testimonials.map((review) => ({
          id: review.id,
          rating: review.rating,
          quote: review.comment ?? "",
          name: review.patientName,
          clinic: review.clinicName,
        }))
      : fallback;

  return (
    <section id="testimonials" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
      <div className="rounded-3xl bg-inverse-canvas px-6 py-14 sm:px-12">
        <p className="text-center text-eyebrow font-medium text-inverse-foreground/60">
          {t("eyebrow")}
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center text-display-md text-inverse-foreground">
          {t("title")}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-subhead text-inverse-foreground/60">
          {t("subtitle")}
        </p>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((item) => (
            <figure
              key={item.id}
              className="flex flex-col rounded-lg bg-inverse-surface p-8 text-inverse-foreground"
            >
              <StarRow rating={item.rating} />
              <blockquote className="mt-4 flex-1 text-lg leading-relaxed">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-6">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-inverse-foreground/60">{item.clinic}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
