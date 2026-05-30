import { Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { SOFA_MODELS } from "../lib/constants";
import type { SofaModel } from "../types/api";

type Step = "model" | "phone" | "done";

export function SofaBotPage() {
  const [step, setStep] = useState<Step>("model");
  const [selectedModel, setSelectedModel] = useState<SofaModel | null>(null);
  const [manualModel, setManualModel] = useState("");
  const [phone, setPhone] = useState("+7");
  const [error, setError] = useState("");

  const selectedLabel = useMemo(() => {
    return SOFA_MODELS.find((model) => model.value === selectedModel)?.label ?? "";
  }, [selectedModel]);

  const createLead = useMutation({
    mutationFn: () => {
      if (!selectedModel) {
        throw new Error("Выберите модель дивана");
      }
      return api.createPublicLead({ selectedModel, phone });
    },
    onSuccess: () => {
      setError("");
      setStep("done");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Не удалось отправить заявку. Попробуйте ещё раз.");
      }
    }
  });

  function chooseModel(model: SofaModel) {
    setSelectedModel(model);
    setError("");
    setStep("phone");
  }

  function submitManualModel() {
    const found = SOFA_MODELS.find((model) => model.number === manualModel.trim());
    if (!found) {
      setError("Введите номер модели из списка");
      return;
    }
    chooseModel(found.value);
  }

  function submitPhone() {
    const normalizedPhone = phone.trim().replace(/[\s()-]/g, "");
    if (!/^\+7\d{10}$/.test(normalizedPhone)) {
      setError("Пожалуйста, напишите номер телефона в формате +7");
      return;
    }
    createLead.mutate();
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-5 text-ink">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-xl flex-col rounded-lg border border-slate-800 bg-slate-900 shadow-sm shadow-black/20">
        <header className="border-b border-slate-800 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-leaf">Подбор дивана</p>
          <h1 className="text-lg font-bold">Мини-бот</h1>
        </header>

        <section className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-slate-800 px-4 py-3 text-sm leading-6 text-slate-100">
            <p className="mb-3 font-semibold">Здравствуйте! 🛋️</p>
            <p className="mb-3">
              Вы перешли на бот для подбора диванов — поможем подобрать ваш идеальный диван.
            </p>
            <p className="mb-3">
              Выберите модель, которая вас заинтересовала, менеджер поможет вам с выбором и вышлет:
            </p>
            <ul className="mb-3 list-inside list-disc">
              <li>фото и видео</li>
              <li>размеры</li>
              <li>варианты тканей</li>
              <li>актуальную цену</li>
            </ul>
            <p className="font-semibold">Напишите номер модели:</p>
            <div className="mt-2 space-y-1">
              {SOFA_MODELS.map((model) => (
                <p key={model.value}>
                  {model.number}. {model.label}
                </p>
              ))}
            </div>
          </div>

          {selectedModel && (
            <div className="ml-auto max-w-[82%] rounded-lg rounded-tr-sm bg-leaf px-4 py-3 text-sm font-semibold text-white">
              {selectedLabel}
            </div>
          )}

          {step === "phone" && (
            <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-slate-800 px-4 py-3 text-sm leading-6 text-slate-100">
              <p className="mb-3 font-semibold">Отличный выбор! ✨</p>
              <p className="mb-3">
                Модель: {selectedLabel}
              </p>
              <p className="mt-3">
                Чтобы отправить вам все фото, варианты тканей и точную стоимость, оставьте номер телефона.
              </p>
              <p className="mt-3 font-semibold">Напишите номер в формате +7</p>
            </div>
          )}

          {step === "done" && (
            <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-emerald-500/15 px-4 py-3 text-sm leading-6 text-emerald-100">
              <p className="mb-2 font-semibold">Спасибо! ✅</p>
              <p>Заявка получена.</p>
              <p>Менеджер скоро свяжется с вами и отправит всю информацию по выбранной модели.</p>
            </div>
          )}

          {error && <div className="rounded-md border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</div>}
        </section>

        {step !== "done" && (
          <footer className="border-t border-slate-800 p-4">
            {step === "model" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SOFA_MODELS.map((model) => (
                    <button key={model.value} type="button" onClick={() => chooseModel(model.value)} className="btn-secondary justify-start">
                      {model.number}. {model.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="field"
                    inputMode="numeric"
                    placeholder="Введите номер модели"
                    value={manualModel}
                    onChange={(event) => setManualModel(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submitManualModel();
                    }}
                  />
                  <button type="button" onClick={submitManualModel} className="btn-primary w-12 px-0" aria-label="Отправить">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="field"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitPhone();
                  }}
                />
                <button type="button" onClick={submitPhone} disabled={createLead.isPending} className="btn-primary w-12 px-0" aria-label="Отправить">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </footer>
        )}
      </div>
    </main>
  );
}
