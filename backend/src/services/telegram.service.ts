import axios from "axios";
import { readFile } from "fs/promises";
import path from "path";
import { ProxyAgent } from "proxy-agent";
import type { SofaLead, SofaModel } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../prisma";
import { SOFA_MODEL_LABELS } from "../constants";
import { normalizeRussianPhone } from "../utils/phone";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: {
      id: number;
      type?: string;
      title?: string;
    };
    from?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    text?: string;
  };
  channel_post?: {
    chat: {
      id: number;
      type?: string;
      title?: string;
      username?: string;
    };
    text?: string;
  };
  callback_query?: {
    id: string;
    from?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      chat: {
        id: number;
        type?: string;
        title?: string;
      };
    };
    data?: string;
  };
};

type TelegramMessageFrom = NonNullable<NonNullable<TelegramUpdate["message"]>["from"]>;

type TelegramReplyMarkup = {
  keyboard: string[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
};

type SendMessageOptions = {
  chatIdEnvName?: string;
  replyMarkup?: TelegramReplyMarkup;
};

type MultipartFile = {
  fieldName: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
};

type CatalogSectionId = "base" | "new" | "standard";
type BotSegment = "base" | "standard" | "new" | "all";
type MenuItemId = CatalogSectionId | "services";

type SofaCard = {
  model: SofaModel;
  label: string;
  imageFile: string;
};

type CatalogSection = {
  id: CatalogSectionId;
  button: string;
  aliases?: string[];
  title: string;
  selectionTitle: string;
  cards: SofaCard[];
};

type BotSession = {
  step: "section" | "models" | "phone";
  segment?: BotSegment;
  sectionId?: CatalogSectionId;
  sectionTitle?: string;
  selectedModel?: SofaModel;
  selectedModelLabel?: string;
};

const BACK_TO_SECTIONS = "Назад к разделам";
const BACK_TO_SECTIONS_LEGACY = "Назад к категориям";
const BACK_TO_MODELS = "Назад к моделям";
const MAIN_MENU = "Главное меню";
const MAIN_MENU_ALT = "В главное меню";
const SERVICES = "Услуги";
const MEDIA_GROUP_LIMIT = 10;
const VALID_SEGMENTS: BotSegment[] = ["base", "standard", "new", "all"];
const SEGMENT_MENU_ITEMS: Record<BotSegment, MenuItemId[]> = {
  base: ["base", "services", "new"],
  standard: ["standard", "services", "new"],
  new: ["new", "services"],
  all: ["base", "standard", "services", "new"]
};

const CATALOG_SECTIONS: CatalogSection[] = [
  {
    id: "base",
    button: "Базовые диваны",
    aliases: ["База"],
    title: "База",
    selectionTitle: "Выберите модель из раздела «База»:",
    cards: [
      { model: "PAULA", label: "Паула", imageFile: "паула база.png" },
      { model: "BERGEN", label: "Берген", imageFile: "берген база.png" },
      { model: "VICTORIA", label: "Виктория", imageFile: "виктория база.png" },
      { model: "MARK", label: "Марк", imageFile: "марк база.png" },
      { model: "MALYSH", label: "Малыш", imageFile: "малыш база.png" },
      { model: "MALTA", label: "Мальта", imageFile: "мальта база.png" },
      { model: "ELVIS_B", label: "Элвис", imageFile: "элвис база.png" }
    ]
  },
  {
    id: "new",
    button: "Новинки",
    title: "Новинки",
    selectionTitle: "Выберите модель из раздела «Новинки»:",
    cards: [
      { model: "DUBLIN", label: "Дублин", imageFile: "Дублин новинка.png" },
      { model: "MARK", label: "Марк", imageFile: "Марк новинка.png" },
      { model: "TOMAS", label: "Томас", imageFile: "Томас новинка.png" }
    ]
  },
  {
    id: "standard",
    button: "Стандартные диваны",
    aliases: ["Стандарт"],
    title: "Стандарт",
    selectionTitle: "Выберите модель из раздела «Стандарт»:",
    cards: [
      { model: "BRIGHTON", label: "Брайтон", imageFile: "Брайтон Стандарт.png" },
      { model: "GUDZON", label: "Гудзон", imageFile: "Гудзон Стандарт.png" },
      { model: "NIZZA", label: "Ницца", imageFile: "Ницца Стандарт.png" },
      { model: "MILAN", label: "Милан", imageFile: "Милан Стандарт.png" }
    ]
  }
];

class TelegramService {
  private agent = config.telegram.proxyUrl
    ? new ProxyAgent({ getProxyForUrl: () => config.telegram.proxyUrl })
    : undefined;
  private sessions = new Map<string, BotSession>();
  private sofaAssetsDir = path.resolve(process.cwd(), "assets", "sofas");
  private isPolling = false;
  private updateOffset = 0;

  startPolling() {
    if (!config.telegram.enabled || !config.telegram.leadBotEnabled || !config.telegram.botToken) {
      return;
    }

    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    void this.pollLoop();
    console.log("Telegram lead bot polling started");
  }

  stopPolling() {
    this.isPolling = false;
  }

  async notifyNewLead(lead: SofaLead) {
    const targetChatId = config.telegram.leadChannelId || config.telegram.adminChatId;
    const text = [
      "Новая заявка из Telegram-бота 🛋️",
      "",
      `Модель: ${SOFA_MODEL_LABELS[lead.selectedModel]}`,
      `Телефон: ${lead.normalizedPhone}`,
      lead.clientName ? `Клиент: ${lead.clientName}` : null,
      lead.adminComment ? `Комментарий: ${lead.adminComment}` : null,
      `Дата: ${this.formatDate(lead.createdAt)}`
    ]
      .filter(Boolean)
      .join("\n");

    await this.sendMessage(targetChatId, text, {
      chatIdEnvName: "TELEGRAM_LEAD_CHANNEL_ID or TELEGRAM_ADMIN_CHAT_ID"
    });
  }

  async notifyManagerAssigned(chatId: string | null | undefined, lead: SofaLead) {
    if (!chatId) {
      return;
    }

    const text = [
      "Вам назначена заявка на подбор дивана 🛋️",
      "",
      `Модель: ${SOFA_MODEL_LABELS[lead.selectedModel]}`,
      `Телефон: ${lead.phone}`,
      `Дата: ${this.formatDate(lead.createdAt)}`
    ].join("\n");

    await this.sendMessage(chatId, text);
  }

  private async pollLoop() {
    while (this.isPolling) {
      try {
        await this.pollOnce();
      } catch (error) {
        console.error("Telegram polling failed", error);
        await this.delay(3000);
      }
    }
  }

  private async pollOnce() {
    const updates = await this.request<TelegramUpdate[]>(
      "getUpdates",
      {
        offset: this.updateOffset || undefined,
        timeout: 25,
        allowed_updates: ["message", "channel_post", "callback_query"]
      },
      30000
    );

    for (const update of updates ?? []) {
      this.updateOffset = update.update_id + 1;
      await this.handleUpdate(update);
    }
  }

  private async handleUpdate(update: TelegramUpdate) {
    const message = update.message;
    const channelPost = update.channel_post;
    const callbackQuery = update.callback_query;
    const text = (message?.text ?? channelPost?.text ?? callbackQuery?.data)?.trim();
    const chat = message?.chat ?? channelPost?.chat ?? callbackQuery?.message?.chat;
    const from = message?.from ?? callbackQuery?.from;
    const chatId = chat?.id;

    if (!text || chatId === undefined) {
      return;
    }

    const key = String(chatId);

    if (text === "/chatid") {
      await this.sendMessage(chatId, `Telegram chat id: ${chatId}`);
      return;
    }

    if (!message && !callbackQuery) {
      return;
    }

    if (chat?.type && chat.type !== "private") {
      return;
    }

    if (text === "/cancel") {
      this.sessions.delete(key);
      const segment = await this.resolveUserSegment(chatId, from);
      await this.sendMessage(chatId, "Диалог сброшен. Напишите /start, чтобы начать заново.", {
        replyMarkup: this.getMainMenuKeyboard(segment)
      });
      return;
    }

    const startSegment = this.getStartSegment(text);
    if (this.isStartCommand(text) || text === "/restart" || this.isMainMenuText(text)) {
      const segment = await this.resolveUserSegment(chatId, from, startSegment);
      await this.sendMainMenu(chatId, key, segment);
      return;
    }

    if (text === BACK_TO_SECTIONS || text === BACK_TO_SECTIONS_LEGACY) {
      const segment = await this.resolveUserSegment(chatId, from);
      await this.sendMainMenu(chatId, key, segment);
      return;
    }

    if (text === SERVICES) {
      const segment = await this.resolveUserSegment(chatId, from);
      this.sessions.set(key, { step: "section", segment });
      await this.sendServices(chatId, segment);
      return;
    }

    const section = this.getSectionByButton(text);
    if (section) {
      const segment = await this.resolveUserSegment(chatId, from);
      if (!this.canOpenSection(segment, section.id)) {
        await this.sendUnavailableSection(chatId, segment);
        return;
      }

      this.sessions.set(key, { step: "models", segment, sectionId: section.id, sectionTitle: section.title });
      await this.sendSection(chatId, section);
      return;
    }

    const session = this.sessions.get(key) ?? { step: "section" };

    if (text === BACK_TO_MODELS) {
      const currentSection = this.getSectionById(session.sectionId);
      if (!currentSection) {
        const segment = await this.resolveUserSegment(chatId, from);
        await this.sendMainMenu(chatId, key, segment);
        return;
      }

      const segment = session.segment ?? (await this.resolveUserSegment(chatId, from));
      if (!this.canOpenSection(segment, currentSection.id)) {
        await this.sendUnavailableSection(chatId, segment);
        return;
      }

      this.sessions.set(key, { step: "models", segment, sectionId: currentSection.id, sectionTitle: currentSection.title });
      await this.sendModelSelection(chatId, currentSection);
      return;
    }

    if (session.step === "section") {
      const segment = session.segment ?? (await this.resolveUserSegment(chatId, from));
      await this.sendMainMenu(chatId, key, segment);
      return;
    }

    if (session.step === "models") {
      const currentSection = this.getSectionById(session.sectionId);
      if (!currentSection) {
        const segment = await this.resolveUserSegment(chatId, from);
        await this.sendMainMenu(chatId, key, segment);
        return;
      }

      const segment = session.segment ?? (await this.resolveUserSegment(chatId, from));
      if (!this.canOpenSection(segment, currentSection.id)) {
        await this.sendUnavailableSection(chatId, segment);
        return;
      }

      const selectedCard = this.getCardBySelection(text, currentSection);
      if (!selectedCard) {
        this.sessions.set(key, { step: "models", segment, sectionId: currentSection.id, sectionTitle: currentSection.title });
        await this.sendMessage(chatId, "Выберите модель кнопкой из списка.", {
          replyMarkup: this.getModelKeyboard(currentSection)
        });
        return;
      }

      this.sessions.set(key, {
        step: "phone",
        segment,
        sectionId: currentSection.id,
        sectionTitle: currentSection.title,
        selectedModel: selectedCard.model,
        selectedModelLabel: selectedCard.label
      });
      await this.sendMessage(chatId, this.getPhoneText(selectedCard.label), {
        replyMarkup: this.getPhoneKeyboard()
      });
      return;
    }

    if (!session.selectedModel) {
      const segment = await this.resolveUserSegment(chatId, from);
      await this.sendMainMenu(chatId, key, segment);
      return;
    }

    const normalizedPhone = normalizeRussianPhone(text);
    if (!normalizedPhone) {
      await this.sendMessage(chatId, "Пожалуйста, напишите полный российский номер в формате +7", {
        replyMarkup: this.getPhoneKeyboard()
      });
      return;
    }

    const modelLabel = session.selectedModelLabel ?? SOFA_MODEL_LABELS[session.selectedModel];
    const sectionTitle = session.sectionTitle ?? this.getSectionById(session.sectionId)?.title ?? null;
    const segment = session.segment ?? (await this.resolveUserSegment(chatId, from));
    const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(" ");
    const clientName =
      [
        fullName,
        from?.username ? `@${from.username}` : "",
        from?.id ? `telegram id: ${from.id}` : ""
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || null;

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.sofaLead.create({
        data: {
          selectedModel: session.selectedModel!,
          phone: text,
          normalizedPhone,
          source: "telegram-bot",
          clientName,
          adminComment: this.getLeadCatalogComment(modelLabel, sectionTitle, segment)
        }
      });

      await tx.leadActivityLog.create({
        data: {
          leadId: created.id,
          userId: null,
          action: "Заявка создана через Telegram",
          oldValue: null,
          newValue: this.getLeadActivityValue(modelLabel, sectionTitle, segment, normalizedPhone)
        }
      });

      return created;
    });

    this.sessions.delete(key);
    await this.sendMessage(
      chatId,
      "Спасибо! ✅\nЗаявка получена.\nМенеджер скоро свяжется с вами и отправит всю информацию по выбранной модели.",
      {
        replyMarkup: this.getFinalKeyboard(segment)
      }
    );
    void this.notifyNewLead(lead);
  }

  private async sendMessage(
    chatId: string | number | null | undefined,
    text: string,
    options: SendMessageOptions = {}
  ) {
    if (!config.telegram.enabled) {
      return;
    }

    if (!config.telegram.botToken || !chatId) {
      console.warn(`Telegram is enabled, but TELEGRAM_BOT_TOKEN or ${options.chatIdEnvName ?? "chat id"} is missing`);
      return;
    }

    try {
      await this.request(
        "sendMessage",
        {
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {})
        }
      );
    } catch (error) {
      console.error("Telegram notification failed", error);
    }
  }

  private async sendSection(chatId: string | number, section: CatalogSection) {
    await this.sendSectionAlbum(chatId, section);
    await this.sendModelSelection(chatId, section);
  }

  private async sendSectionAlbum(chatId: string | number, section: CatalogSection) {
    if (!config.telegram.enabled) {
      return;
    }

    if (!config.telegram.botToken || !chatId) {
      console.warn("Telegram is enabled, but TELEGRAM_BOT_TOKEN or chat id is missing");
      return;
    }

    const mediaItems: Array<{ card: SofaCard; file: MultipartFile; index: number }> = [];

    for (const [index, card] of section.cards.entries()) {
      const photoPath = path.join(this.sofaAssetsDir, card.imageFile);

      try {
        mediaItems.push({
          card,
          index,
          file: {
            fieldName: `photo${index}`,
            filename: card.imageFile,
            contentType: this.getImageContentType(photoPath),
            buffer: await readFile(photoPath)
          }
        });
      } catch (error) {
        if (this.isFileNotFoundError(error)) {
          console.warn(`Sofa image not found: ${photoPath}`);
          continue;
        }

        console.error("Telegram photo read failed", error);
      }
    }

    for (const group of this.chunkArray(mediaItems, MEDIA_GROUP_LIMIT)) {
      if (!group.length) {
        continue;
      }

      if (group.length === 1) {
        await this.sendSinglePhoto(chatId, group[0]);
        continue;
      }

      try {
        await this.requestMultipartFiles(
          "sendMediaGroup",
          {
            chat_id: chatId,
            media: JSON.stringify(
              group.map((item) => ({
                type: "photo",
                media: `attach://${item.file.fieldName}`,
                caption: `${item.index + 1}. ${item.card.label}`
              }))
            )
          },
          group.map((item) => item.file),
          30000
        );
      } catch (error) {
        console.error("Telegram media group failed", error);
      }
    }
  }

  private async sendSinglePhoto(chatId: string | number, item: { card: SofaCard; file: MultipartFile; index: number }) {
    try {
      await this.requestMultipartFiles(
        "sendPhoto",
        {
          chat_id: chatId,
          caption: `${item.index + 1}. ${item.card.label}`
        },
        [{ ...item.file, fieldName: "photo" }],
        30000
      );
    } catch (error) {
      console.error("Telegram photo failed", error);
    }
  }

  private async request<T>(method: string, data: Record<string, unknown>, timeout = 10000): Promise<T | undefined> {
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/${method}`;
    const response = await axios.post<TelegramApiResponse<T>>(url, data, {
      timeout,
      httpAgent: this.agent,
      httpsAgent: this.agent,
      proxy: false
    });

    if (!response.data.ok) {
      throw new Error(response.data.description ?? `Telegram method ${method} failed`);
    }

    return response.data.result;
  }

  private async requestMultipartFiles<T>(
    method: string,
    fields: Record<string, string | number | boolean>,
    files: MultipartFile[],
    timeout = 10000
  ): Promise<T | undefined> {
    const boundary = `sona-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const parts: Buffer[] = [];

    for (const [name, value] of Object.entries(fields)) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${String(value)}\r\n`
        )
      );
    }

    for (const file of files) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
        ),
        file.buffer,
        Buffer.from("\r\n")
      );
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/${method}`;
    const response = await axios.post<TelegramApiResponse<T>>(url, body, {
      timeout,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length
      },
      httpAgent: this.agent,
      httpsAgent: this.agent,
      proxy: false
    });

    if (!response.data.ok) {
      throw new Error(response.data.description ?? `Telegram method ${method} failed`);
    }

    return response.data.result;
  }

  private async sendMainMenu(chatId: string | number, sessionKey: string, segment: BotSegment) {
    this.sessions.set(sessionKey, { step: "section", segment });
    await this.sendMessage(chatId, this.getWelcomeText(), {
      replyMarkup: this.getMainMenuKeyboard(segment)
    });
  }

  private async sendModelSelection(chatId: string | number, section: CatalogSection) {
    await this.sendMessage(chatId, this.getModelSelectionText(section), {
      replyMarkup: this.getModelKeyboard(section)
    });
  }

  private async sendServices(chatId: string | number, segment: BotSegment) {
    await this.sendMessage(
      chatId,
      [
        "Мы поможем подобрать диван под ваш бюджет, стиль и размер комнаты.",
        "",
        "Менеджер подскажет:",
        "• актуальные цены",
        "• размеры",
        "• варианты тканей",
        "• наличие",
        "• сроки доставки",
        "• подходящую модель под интерьер"
      ].join("\n"),
      {
        replyMarkup: this.getServicesKeyboard(segment)
      }
    );
  }

  private async sendUnavailableSection(chatId: string | number, segment: BotSegment) {
    await this.sendMessage(chatId, "Этот раздел недоступен по вашей ссылке.\nВернитесь в главное меню.", {
      replyMarkup: this.getFinalKeyboard(segment)
    });
  }

  private getWelcomeText() {
    return [
      "Здравствуйте! 🛋️",
      "Поможем подобрать диван под ваш бюджет, стиль и размер комнаты.",
      "",
      "Выберите подходящий раздел каталога:"
    ].join("\n");
  }

  private getModelSelectionText(section: CatalogSection) {
    return [
      section.selectionTitle,
      "",
      section.cards
        .map((card, index) => {
          return `${index + 1}. ${card.label}`;
        })
        .join("\n")
    ].join("\n");
  }

  private getMainMenuKeyboard(segment: BotSegment): TelegramReplyMarkup {
    return this.createKeyboard(
      SEGMENT_MENU_ITEMS[segment].map((itemId) => {
        if (itemId === "services") {
          return [SERVICES];
        }

        return [this.getSectionById(itemId)?.button ?? itemId];
      })
    );
  }

  private getModelKeyboard(section: CatalogSection): TelegramReplyMarkup {
    return this.createKeyboard([
      ...section.cards.map((card, index) => [`${index + 1}. ${card.label}`]),
      [BACK_TO_SECTIONS],
      [MAIN_MENU]
    ]);
  }

  private getPhoneKeyboard(): TelegramReplyMarkup {
    return this.createKeyboard([[BACK_TO_MODELS], [BACK_TO_SECTIONS], [MAIN_MENU]]);
  }

  private getServicesKeyboard(_segment: BotSegment): TelegramReplyMarkup {
    return this.createKeyboard([[BACK_TO_SECTIONS], [MAIN_MENU]]);
  }

  private getFinalKeyboard(_segment: BotSegment): TelegramReplyMarkup {
    return this.createKeyboard([[MAIN_MENU]]);
  }

  private createKeyboard(keyboard: string[][]): TelegramReplyMarkup {
    return {
      keyboard,
      resize_keyboard: true
    };
  }

  private getStartSegment(text: string): BotSegment | null {
    const match = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/i);
    if (!match) {
      return null;
    }

    return this.normalizeSegment(match[1]);
  }

  private isStartCommand(text: string) {
    return /^\/start(?:@\w+)?(?:\s+\S+)?$/i.test(text);
  }

  private normalizeSegment(value: string | undefined): BotSegment | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    return VALID_SEGMENTS.includes(normalized as BotSegment) ? (normalized as BotSegment) : null;
  }

  private async resolveUserSegment(
    chatId: string | number,
    from: TelegramMessageFrom | undefined,
    explicitSegment?: BotSegment | null
  ): Promise<BotSegment> {
    const telegramUserId = this.getTelegramUserId(chatId, from);
    const userProfile = {
      username: from?.username ?? null,
      firstName: from?.first_name ?? null
    };

    if (explicitSegment) {
      const session = await prisma.telegramUserSession.upsert({
        where: { telegramUserId },
        create: {
          telegramUserId,
          ...userProfile,
          segment: explicitSegment
        },
        update: {
          ...userProfile,
          segment: explicitSegment
        }
      });

      return session.segment as BotSegment;
    }

    const existing = await prisma.telegramUserSession.findUnique({
      where: { telegramUserId }
    });

    if (existing) {
      await prisma.telegramUserSession.update({
        where: { telegramUserId },
        data: userProfile
      });

      return existing.segment as BotSegment;
    }

    const created = await prisma.telegramUserSession.create({
      data: {
        telegramUserId,
        ...userProfile,
        segment: "all"
      }
    });

    return created.segment as BotSegment;
  }

  private getTelegramUserId(chatId: string | number, from: TelegramMessageFrom | undefined) {
    return String(from?.id ?? chatId);
  }

  private canOpenSection(segment: BotSegment, sectionId: CatalogSectionId) {
    return SEGMENT_MENU_ITEMS[segment].includes(sectionId);
  }

  private getSectionByButton(text: string) {
    const normalized = text.trim().toLowerCase();
    return (
      CATALOG_SECTIONS.find((section) => {
        return (
          section.id === normalized ||
          section.button.toLowerCase() === normalized ||
          section.aliases?.some((alias) => alias.toLowerCase() === normalized)
        );
      }) ?? null
    );
  }

  private getSectionById(sectionId: CatalogSectionId | undefined) {
    return CATALOG_SECTIONS.find((section) => section.id === sectionId) ?? null;
  }

  private getCardBySelection(text: string, section: CatalogSection) {
    const normalized = text.trim().toLowerCase();
    return (
      section.cards.find((card, index) => {
        const number = String(index + 1);
        return normalized === number || normalized === `${number}. ${card.label}`.toLowerCase();
      }) ?? null
    );
  }

  private isMainMenuText(text: string) {
    const normalized = text.trim().toLowerCase();
    return normalized === MAIN_MENU.toLowerCase() || normalized === MAIN_MENU_ALT.toLowerCase();
  }

  private getImageContentType(photoPath: string) {
    const extension = path.extname(photoPath).toLowerCase();
    if (extension === ".jpg" || extension === ".jpeg") {
      return "image/jpeg";
    }

    if (extension === ".webp") {
      return "image/webp";
    }

    return "image/png";
  }

  private isFileNotFoundError(error: unknown) {
    return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
  }

  private getPhoneText(model: string) {
    return [
      "Отличный выбор! ✨",
      "",
      `Модель: ${model}`,
      "",
      "Чтобы отправить вам все фото, варианты тканей и точную стоимость, оставьте номер телефона.",
      "",
      "Напишите номер в формате +7"
    ].join("\n");
  }

  private getLeadCatalogComment(modelLabel: string, sectionTitle: string | null, segment: BotSegment) {
    return [
      "Заявка из Telegram.",
      `Сегмент ссылки: ${segment}.`,
      `Модель: ${modelLabel}`,
      sectionTitle ? `Раздел: ${sectionTitle}.` : null,
      "Источник: telegram-bot"
    ]
      .filter(Boolean)
      .join("\n");
  }

  private getLeadActivityValue(modelLabel: string, sectionTitle: string | null, segment: BotSegment, normalizedPhone: string) {
    return [
      `Модель: ${modelLabel}`,
      sectionTitle ? `Раздел: ${sectionTitle}` : null,
      `Сегмент ссылки: ${segment}`,
      `Телефон: ${normalizedPhone}`
    ]
      .filter(Boolean)
      .join("; ");
  }

  private chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Moscow"
    }).format(date);
  }
}

export const telegramService = new TelegramService();
