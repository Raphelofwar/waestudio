"use client";

import Image from "next/image";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SocialFooter from "./SocialFooter";
import PaymentWhatsApp from "./PaymentWhatsApp";

type Step =
  | "home"
  | "calendar"
  | "time"
  | "service"
  | "details"
  | "paymentMethod"
  | "paymentDetails"
  | "success";

type PaymentMethod =
  | "mobile"
  | "transfer"
  | "cash"
  | null;

type CashCurrency =
  | "USD"
  | "VES"
  | null;

type Service = {
  id: string;
  name: string;
  price: number;
  duration: string;
  description: string;
  includes: string[];
};

type BcvApiResponse = {
  ok: boolean;
  rate: number | null;
  date: string | null;
  updatedAt: string | null;
  source: string;
  message?: string;
};

type BcvStatus =
  | "loading"
  | "success"
  | "error";

type BookingApiResponse = {
  ok: boolean;
  bookingId?: string;
  bookingCode?: string;
  paymentMethod?: string;
  cashCurrency?: string;
  status?: string;
  code?: string;
  message?: string;
};

type AvailabilitySlot = {
  time: string;
  label: string;
  available: boolean;
  availableServices: string[];
  reason: string | null;
};

type AvailabilityApiResponse = {
  ok: boolean;
  date: string;
  weekday: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  slots: AvailabilitySlot[];
  message?: string;
};

type AvailabilityStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function triggerTapFeedback() {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  ) {
    navigator.vibrate(12);
  }
}

const services: Service[] = [
  {
    id: "essential",
    name: "Corte Esencial",
    price: 7,
    duration: "45 min",
    description:
      "Corte de cabello con acabado profesional.",
    includes: [
      "Corte de cabello",
      "Acabado y styling",
    ],
  },
  {
    id: "premium",
    name: "Experiencia Premium",
    price: 10,
    duration: "75 min",
    description:
      "Una experiencia completa de cuidado masculino.",
    includes: [
      "Corte de cabello",
      "Perfilado de barba",
      "Lavado",
      "Mascarilla facial",
    ],
  },
];

const availableHours = [
  "9:00 AM",
  "9:45 AM",
  "10:30 AM",
  "11:15 AM",
  "2:00 PM",
  "2:45 PM",
  "3:30 PM",
  "4:15 PM",
  "5:00 PM",
];

const todayQuickHours = [
  "10:00 AM",
  "11:30 AM",
  "2:00 PM",
  "3:30 PM",
  "5:00 PM",
];

const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const weekDays = [
  "D",
  "L",
  "M",
  "M",
  "J",
  "V",
  "S",
];

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    minHeight: 56,
    borderRadius: "16px",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
  },
  "& .MuiInputBase-input": {
    fontSize: "15px",
    color: "#f5f1e8",
  },
  "& .MuiInputBase-input::placeholder": {
    color: "rgba(245, 241, 232, 0.22)",
    opacity: 1,
  },
};

const primaryActionSx = {
  minHeight: 56,
  px: 3,
  backgroundColor: "#f5f1e8",
  color: "#090909",
  fontSize: 14,
  fontWeight: 600,
  "&:hover": {
    backgroundColor: "#f5f1e8",
  },
  "&:active": {
    backgroundColor: "#ddd7cb",
    boxShadow: "inset 0 3px 10px rgba(0,0,0,0.28)",
  },
  "&.Mui-disabled": {
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    color: "rgba(245, 241, 232, 0.25)",
  },
};

const secondaryActionSx = {
  minHeight: 44,
  px: 2.5,
  borderColor: "rgba(255, 255, 255, 0.12)",
  color: "rgba(245, 241, 232, 0.62)",
  fontSize: 12,
  "&:hover": {
    borderColor: "rgba(197, 166, 109, 0.55)",
    backgroundColor: "rgba(197, 166, 109, 0.06)",
  },
};

function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <header className="flex items-center justify-between">
      <IconButton
        onClick={onBack}
        onPointerDown={triggerTapFeedback}
        aria-label="Volver"
        size="small"
        sx={{
          width: 44,
          height: 44,
          border: "1px solid rgba(255, 255, 255, 0.10)",
          color: "rgba(245, 241, 232, 0.60)",
          "&:hover": {
            borderColor: "rgba(197, 166, 109, 0.45)",
            backgroundColor: "rgba(197, 166, 109, 0.06)",
            color: "#c5a66d",
          },
          "&:active": {
            borderColor: "rgba(197, 166, 109, 0.70)",
            backgroundColor: "rgba(197, 166, 109, 0.10)",
            color: "#c5a66d",
          },
        }}
      >
        <ArrowBackRoundedIcon fontSize="small" />
      </IconButton>

      <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">
        {title}
      </p>

      <div className="h-11 w-11" />
    </header>
  );
}

export default function Home() {
  const today = useMemo(
    () => new Date(),
    []
  );

  const [step, setStep] =
    useState<Step>("home");

  const [currentMonth, setCurrentMonth] =
    useState(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState<Date | null>(null);

  const [
    selectedTime,
    setSelectedTime,
  ] = useState<string | null>(null);

  const [
    selectedService,
    setSelectedService,
  ] = useState<Service | null>(null);

  const [name, setName] =
    useState("");

  const [whatsapp, setWhatsapp] =
    useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>(null);

  const [
    cashCurrency,
    setCashCurrency,
  ] = useState<CashCurrency>(null);

  const [bank, setBank] =
    useState("");

  const [reference, setReference] =
    useState("");

  const [receipt, setReceipt] =
    useState<File | null>(null);

  const [bcvRate, setBcvRate] =
    useState<number | null>(null);

  const [bcvDate, setBcvDate] =
    useState<string | null>(null);

  const [bcvStatus, setBcvStatus] =
    useState<BcvStatus>("loading");

  const [
    paymentSubmitting,
    setPaymentSubmitting,
  ] = useState(false);

  const [
    paymentError,
    setPaymentError,
  ] = useState<string | null>(null);

  const [
    bookingCode,
    setBookingCode,
  ] = useState<string | null>(null);

  const [
    availabilitySlots,
    setAvailabilitySlots,
  ] = useState<AvailabilitySlot[]>([]);

  const [
    availabilityStatus,
    setAvailabilityStatus,
  ] = useState<AvailabilityStatus>("idle");

  const [
    availabilityError,
    setAvailabilityError,
  ] = useState<string | null>(null);

  const [
    todayAvailabilitySlots,
    setTodayAvailabilitySlots,
  ] = useState<AvailabilitySlot[]>([]);

  const [
    todayAvailabilityStatus,
    setTodayAvailabilityStatus,
  ] = useState<AvailabilityStatus>("loading");

  const [
    todayIsOpen,
    setTodayIsOpen,
  ] = useState<boolean | null>(null);

  const [
    selectedAvailableServices,
    setSelectedAvailableServices,
  ] = useState<string[]>([]);

  const [
    availabilityRefreshKey,
    setAvailabilityRefreshKey,
  ] = useState(0);

  const [
    installPrompt,
    setInstallPrompt,
  ] = useState<DeferredInstallPrompt | null>(null);

  const [
    installCardVisible,
    setInstallCardVisible,
  ] = useState(false);

  const [
    isIosInstall,
    setIsIosInstall,
  ] = useState(false);

  const [
    iosInstallHelpOpen,
    setIosInstallHelpOpen,
  ] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone =
      navigator as Navigator & {
        standalone?: boolean;
      };

    const alreadyInstalled =
      window.matchMedia(
        "(display-mode: standalone)"
      ).matches ||
      navigatorWithStandalone.standalone ===
        true;

    if (alreadyInstalled) {
      setInstallCardVisible(false);
      return;
    }

    const userAgent =
      navigator.userAgent;

    const isiOS =
      /iphone|ipad|ipod/i.test(
        userAgent
      );

    const isAndroid =
      /android/i.test(
        userAgent
      );

    setIsIosInstall(isiOS);

    if (isiOS) {
      setInstallCardVisible(true);
    }

    const handleBeforeInstallPrompt =
      (event: Event) => {
        if (
          !isAndroid &&
          !/mobile/i.test(
            userAgent
          )
        ) {
          return;
        }

        event.preventDefault();

        setInstallPrompt(
          event as DeferredInstallPrompt
        );

        setInstallCardVisible(true);
      };

    const handleAppInstalled =
      () => {
        setInstallPrompt(null);
        setInstallCardVisible(false);
        setIosInstallHelpOpen(false);
      };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );
    };
  }, []);

  useEffect(() => {
    async function loadRate() {
      try {
        setBcvStatus("loading");

        const response = await fetch(
          "/api/bcv",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "BCV API unavailable"
          );
        }

        const data: BcvApiResponse =
          await response.json();

        if (
          !data.ok ||
          typeof data.rate !== "number"
        ) {
          throw new Error(
            "Invalid BCV response"
          );
        }

        setBcvRate(data.rate);
        setBcvDate(data.date);
        setBcvStatus("success");
      } catch (error) {
        console.error(
          "Error loading BCV:",
          error
        );

        setBcvRate(null);
        setBcvDate(null);
        setBcvStatus("error");
      }
    }

    loadRate();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTodayAvailability() {
      try {
        setTodayAvailabilityStatus("loading");

        const date = formatApiDate(today);

        const response = await fetch(
          `/api/availability?date=${date}&t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

        const data: AvailabilityApiResponse =
          await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(
            data.message ||
              "No fue posible consultar la disponibilidad."
          );
        }

        if (cancelled) {
          return;
        }

        setTodayIsOpen(data.isOpen);
        setTodayAvailabilitySlots(
          data.slots || []
        );
        setTodayAvailabilityStatus("success");
      } catch (error) {
        console.error(
          "Error loading today availability:",
          error
        );

        if (cancelled) {
          return;
        }

        setTodayIsOpen(null);
        setTodayAvailabilitySlots([]);
        setTodayAvailabilityStatus("error");
      }
    }

    loadTodayAvailability();

    return () => {
      cancelled = true;
    };
  }, [today, availabilityRefreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedDateAvailability() {
      if (!selectedDate) {
        setAvailabilitySlots([]);
        setAvailabilityStatus("idle");
        setAvailabilityError(null);
        return;
      }

      try {
        setAvailabilityStatus("loading");
        setAvailabilityError(null);

        const date = formatApiDate(
          selectedDate
        );

        const response = await fetch(
          `/api/availability?date=${date}&t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

        const data: AvailabilityApiResponse =
          await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(
            data.message ||
              "No fue posible consultar la disponibilidad."
          );
        }

        if (cancelled) {
          return;
        }

        setAvailabilitySlots(
          data.slots || []
        );
        setAvailabilityStatus("success");
      } catch (error) {
        console.error(
          "Error loading selected date availability:",
          error
        );

        if (cancelled) {
          return;
        }

        setAvailabilitySlots([]);
        setAvailabilityStatus("error");
        setAvailabilityError(
          error instanceof Error
            ? error.message
            : "No fue posible consultar la disponibilidad."
        );
      }
    }

    loadSelectedDateAvailability();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, availabilityRefreshKey]);

  async function retryBcvRate() {
    try {
      setBcvStatus("loading");

      const response = await fetch(
        `/api/bcv?t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "BCV API unavailable"
        );
      }

      const data: BcvApiResponse =
        await response.json();

      if (
        !data.ok ||
        typeof data.rate !== "number"
      ) {
        throw new Error(
          "Invalid BCV response"
        );
      }

      setBcvRate(data.rate);
      setBcvDate(data.date);
      setBcvStatus("success");
    } catch (error) {
      console.error(
        "Error retrying BCV:",
        error
      );

      setBcvRate(null);
      setBcvDate(null);
      setBcvStatus("error");
    }
  }

  const calendarDays =
    useMemo(() => {
      const year =
        currentMonth.getFullYear();

      const month =
        currentMonth.getMonth();

      const firstDay =
        new Date(
          year,
          month,
          1
        ).getDay();

      const totalDays =
        new Date(
          year,
          month + 1,
          0
        ).getDate();

      const days:
        Array<number | null> = [];

      for (
        let i = 0;
        i < firstDay;
        i++
      ) {
        days.push(null);
      }

      for (
        let day = 1;
        day <= totalDays;
        day++
      ) {
        days.push(day);
      }

      return days;
    }, [currentMonth]);

  const phoneDigits =
    whatsapp.replace(/\D/g, "");

  const referenceDigits =
    reference.replace(/\D/g, "");

  const validDetails =
    name.trim().length >= 2 &&
    phoneDigits.length >= 10;

  const isCashPayment =
    paymentMethod === "cash";

  const isElectronicPayment =
    paymentMethod === "mobile" ||
    paymentMethod === "transfer";

  const validPayment =
    isCashPayment
      ? cashCurrency !== null
      : isElectronicPayment &&
        bcvRate !== null &&
        bank.trim().length >= 2 &&
        referenceDigits.length >= 4 &&
        receipt !== null;

  const todayQuickSlots =
    todayAvailabilitySlots.filter(
      (slot) =>
        slot.available &&
        todayQuickHours.includes(
          slot.label
        )
    );

  const visibleAvailabilitySlots =
    availabilitySlots.filter(
      (slot) =>
        slot.available &&
        availableHours.includes(
          slot.label
        )
    );

  const visibleServices =
    services.filter(
      (service) =>
        selectedAvailableServices.includes(
          service.id
        )
    );

  const amountVes =
    selectedService &&
    bcvRate !== null &&
    paymentMethod !== "cash"
      ? selectedService.price *
        bcvRate
      : null;

  function formatVes(
    amount: number
  ) {
    return new Intl.NumberFormat(
      "es-VE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ).format(amount);
  }

  function formatBcvRate(
    rate: number
  ) {
    return new Intl.NumberFormat(
      "es-VE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }
    ).format(rate);
  }

  function formatBcvDate() {
    if (!bcvDate) {
      return "";
    }

    const parts =
      bcvDate.split("-");

    if (parts.length !== 3) {
      return bcvDate;
    }

    const [
      year,
      month,
      day,
    ] = parts;

    return `${day}/${month}/${year}`;
  }

  function formatApiDate(
    date: Date
  ) {
    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatApiTime(
    time: string
  ) {
    const match = time.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    );

    if (!match) {
      return time;
    }

    let hour = Number(match[1]);
    const minute = match[2];
    const period = match[3].toUpperCase();

    if (period === "AM" && hour === 12) {
      hour = 0;
    }

    if (period === "PM" && hour !== 12) {
      hour += 12;
    }

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  function isPastDay(
    day: number
  ) {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    const normalizedToday =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

    return (
      date < normalizedToday
    );
  }

  function isSunday(
    day: number
  ) {
    return (
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day
      ).getDay() === 0
    );
  }

  function selectCalendarDay(
    day: number
  ) {
    if (
      isPastDay(day) ||
      isSunday(day)
    ) {
      return;
    }

    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    setSelectedDate(date);
    setSelectedTime(null);
    setSelectedService(null);
    setSelectedAvailableServices([]);
    setStep("time");
  }

  function changeMonth(
    direction: number
  ) {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() +
          direction,
        1
      )
    );
  }

  function selectTodayTime(
    time: string
  ) {
    const slot =
      todayAvailabilitySlots.find(
        (item) =>
          item.label === time &&
          item.available
      );

    if (!slot) {
      return;
    }

    setSelectedDate(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      )
    );

    setSelectedTime(time);
    setSelectedService(null);
    setSelectedAvailableServices(
      slot.availableServices
    );
    setStep("service");
  }

  function selectTime(
    time: string
  ) {
    const slot =
      availabilitySlots.find(
        (item) =>
          item.label === time &&
          item.available
      );

    if (!slot) {
      return;
    }

    setSelectedTime(time);
    setSelectedService(null);
    setSelectedAvailableServices(
      slot.availableServices
    );
    setStep("service");
  }

  function selectService(
    service: Service
  ) {
    if (
      !selectedAvailableServices.includes(
        service.id
      )
    ) {
      return;
    }

    setSelectedService(service);
    setStep("details");
  }

  function selectPaymentMethod(
    method:
      | "mobile"
      | "transfer"
      | "cash"
  ) {
    setPaymentMethod(method);
    setCashCurrency(null);

    setBank("");
    setReference("");
    setReceipt(null);
    setPaymentError(null);

    setStep(
      "paymentDetails"
    );
  }

  function handleReceipt(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      setReceipt(null);
      return;
    }

    setReceipt(file);
  }

  async function reportPayment() {
    if (
      !validPayment ||
      paymentSubmitting ||
      !selectedDate ||
      !selectedTime ||
      !selectedService ||
      !paymentMethod
    ) {
      return;
    }

    if (
      paymentMethod === "cash" &&
      !cashCurrency
    ) {
      return;
    }

    if (
      paymentMethod !== "cash" &&
      (bcvRate === null || !receipt)
    ) {
      return;
    }

    try {
      setPaymentSubmitting(true);
      setPaymentError(null);

      const formData = new FormData();

      formData.append(
        "customerName",
        name.trim()
      );
      formData.append(
        "customerWhatsapp",
        whatsapp.trim()
      );
      formData.append(
        "serviceCode",
        selectedService.id
      );
      formData.append(
        "date",
        formatApiDate(selectedDate)
      );
      formData.append(
        "time",
        formatApiTime(selectedTime)
      );
      formData.append(
        "paymentMethod",
        paymentMethod
      );

      if (paymentMethod === "cash") {
        formData.append(
          "cashCurrency",
          cashCurrency || ""
        );
      } else {
        formData.append(
          "payerBank",
          bank.trim()
        );
        formData.append(
          "reference",
          reference.trim()
        );
        formData.append(
          "bcvRate",
          String(bcvRate)
        );

        if (receipt) {
          formData.append(
            "receipt",
            receipt
          );
        }
      }

      const response = await fetch(
        "/api/bookings",
        {
          method: "POST",
          body: formData,
        }
      );

      const data: BookingApiResponse =
        await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ||
            "No fue posible registrar la reserva."
        );
      }

      setBookingCode(
        data.bookingCode || null
      );
      setAvailabilityRefreshKey(
        (value) => value + 1
      );
      setStep("success");
    } catch (error) {
      console.error(
        "Error reporting payment:",
        error
      );

      setPaymentError(
        error instanceof Error
          ? error.message
          : "No fue posible registrar la reserva."
      );
    } finally {
      setPaymentSubmitting(false);
    }
  }

  function startNewBooking() {
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedService(null);
    setSelectedAvailableServices([]);

    setName("");
    setWhatsapp("");

    setPaymentMethod(null);
    setCashCurrency(null);
    setBank("");
    setReference("");
    setReceipt(null);
    setPaymentError(null);
    setPaymentSubmitting(false);
    setBookingCode(null);

    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

    setStep("home");
  }

  function goBack() {
    if (
      step === "calendar"
    ) {
      setStep("home");
      return;
    }

    if (step === "time") {
      setStep("calendar");
      return;
    }

    if (
      step === "service"
    ) {
      if (
        selectedDate &&
        selectedDate.toDateString() ===
          today.toDateString()
      ) {
        setStep("home");
      } else {
        setStep("time");
      }

      return;
    }

    if (
      step === "details"
    ) {
      setStep("service");
      return;
    }

    if (
      step ===
      "paymentMethod"
    ) {
      setStep("details");
      return;
    }

    if (
      step ===
      "paymentDetails"
    ) {
      setStep(
        "paymentMethod"
      );
    }
  }

  async function handleInstallApp() {
    triggerTapFeedback();

    if (installPrompt) {
      try {
        await installPrompt.prompt();

        await installPrompt.userChoice;
      } catch (error) {
        console.error(
          "Error opening PWA install prompt:",
          error
        );
      } finally {
        setInstallPrompt(null);
        setInstallCardVisible(false);
      }

      return;
    }

    if (isIosInstall) {
      setIosInstallHelpOpen(
        (value) => !value
      );
    }
  }

  function formatDate(
    date: Date
  ) {
    return date.toLocaleDateString(
      "es-VE",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
      }
    );
  }

  return (
    <main className="min-h-[100svh] bg-[#090909] text-[#f5f1e8]">
      <div className="mx-auto min-h-[100svh] w-full max-w-md sm:max-w-xl">

        {step === "home" && (
          <section className="flex min-h-[100svh] flex-col px-5 pb-6 pt-5">
            <header className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-20 shrink-0">
                  <Image
                    src="/waestudio-logo.png"
                    alt="WAESTUDIO"
                    fill
                    sizes="80px"
                    priority
                    className="object-contain"
                  />
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-[#c5a66d]">
                    WAESTUDIO
                  </p>

                  <p className="mt-1 text-[8px] uppercase tracking-[0.22em] text-white/30">
                    Men&apos;s Grooming
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    todayAvailabilityStatus ===
                    "loading"
                      ? "bg-white/30"
                      : todayIsOpen
                        ? "bg-emerald-400"
                        : "bg-red-400/70"
                  }`}
                />

                <span className="text-[11px] text-white/45">
                  {todayAvailabilityStatus ===
                  "loading"
                    ? "Consultando"
                    : todayIsOpen
                      ? "Disponible"
                      : "Cerrado hoy"}
                </span>
              </div>
            </header>

            <div className="flex flex-1 flex-col justify-center py-8">
              <p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-[#c5a66d]">
                Barbería · Grooming
              </p>

              <h1 className="text-[46px] font-medium leading-[0.93] tracking-[-0.045em]">
                Tu tiempo.
                <br />
                Tu estilo.
                <br />
                <span className="text-white/30">
                  Tu momento.
                </span>
              </h1>

              <p className="mt-6 max-w-sm text-[15px] leading-6 text-white/45">
                Reserva tu cita en segundos.
                Sin complicaciones.
              </p>

              <Button
                type="button"
                variant="contained"
                fullWidth
                disableRipple
                onClick={() =>
                  setStep(
                    "calendar"
                  )
                }
                onPointerDown={triggerTapFeedback}
                sx={{
                  mt: 4,
                  minHeight: 56,
                  px: 3,
                  backgroundColor: "#f5f1e8",
                  color: "#090909",
                  fontSize: 14,
                  fontWeight: 600,
                  "&:hover": {
                    backgroundColor: "#f5f1e8",
                  },
                  "&:active": {
                    backgroundColor: "#ddd7cb",
                    boxShadow:
                      "inset 0 3px 10px rgba(0,0,0,0.28)",
                  },
                }}
              >
                Reservar cita
              </Button>

              {installCardVisible && (
                <div className="mt-4 rounded-[22px] border border-[#c5a66d]/20 bg-[#c5a66d]/[0.045] p-4">
                  <div className="flex items-center gap-3.5">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[14px] border border-white/10 bg-[#090909] shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
                      <Image
                        src="/waestudio-app-192.png"
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-[#c5a66d]">
                        Acceso rápido
                      </p>

                      <p className="mt-1 text-sm font-medium text-[#f5f1e8]">
                        Instala WAESTUDIO
                      </p>

                      <p className="mt-1 text-[11px] leading-4 text-white/35">
                        Reserva desde tu pantalla de inicio como una app.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outlined"
                      disableRipple
                      onClick={
                        handleInstallApp
                      }
                      sx={{
                        minWidth: "auto",
                        flexShrink: 0,
                        px: 1.8,
                        py: 1,
                        borderRadius: "12px",
                        borderColor:
                          "rgba(197, 166, 109, 0.42)",
                        color: "#c5a66d",
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        "&:hover": {
                          borderColor:
                            "rgba(197, 166, 109, 0.65)",
                          backgroundColor:
                            "rgba(197, 166, 109, 0.07)",
                        },
                        "&:active": {
                          backgroundColor:
                            "rgba(197, 166, 109, 0.12)",
                        },
                      }}
                    >
                      Instalar
                    </Button>
                  </div>

                  {isIosInstall &&
                    iosInstallHelpOpen && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <p className="text-[11px] leading-5 text-white/45">
                          En iPhone: toca{" "}
                          <span className="font-medium text-[#f5f1e8]">
                            Compartir
                          </span>{" "}
                          en Safari y selecciona{" "}
                          <span className="font-medium text-[#f5f1e8]">
                            Agregar a pantalla de inicio
                          </span>
                          .
                        </p>
                      </div>
                    )}
                </div>
              )}

              <div className="mt-10 rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.28em] text-white/30">
                      Disponibilidad rápida
                    </p>

                    <h2 className="mt-3 text-3xl font-light">
                      Hoy
                    </h2>

                    <p className="mt-1 text-xs text-white/35">
                      Toca una hora para reservar
                    </p>
                  </div>

                  <span className="rounded-full border border-[#c5a66d]/30 bg-[#c5a66d]/10 px-3 py-2 text-[10px] text-[#c5a66d]">
                    {todayAvailabilityStatus ===
                    "loading"
                      ? "..."
                      : todayIsOpen
                        ? `${todayQuickSlots.length} cupos`
                        : "Cerrado"}
                  </span>
                </div>

                {todayAvailabilityStatus ===
                  "loading" && (
                  <div className="mt-6 grid grid-cols-2 gap-2.5">
                    {[1, 2, 3, 4].map(
                      (item) => (
                        <Skeleton
                          key={item}
                          variant="rounded"
                          animation="wave"
                          height={48}
                          sx={{
                            borderRadius: "12px",
                            backgroundColor: "rgba(255, 255, 255, 0.035)",
                          }}
                        />
                      )
                    )}
                  </div>
                )}

                {todayAvailabilityStatus ===
                  "error" && (
                  <div className="mt-6">
                    <Alert
                      severity="error"
                      variant="outlined"
                      sx={{
                        borderRadius: "16px",
                        borderColor: "rgba(248, 113, 113, 0.20)",
                        backgroundColor: "rgba(248, 113, 113, 0.05)",
                        color: "rgba(254, 202, 202, 0.78)",
                        fontSize: 12,
                      }}
                    >
                      No pudimos consultar los cupos de hoy.
                    </Alert>

                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() =>
                        setAvailabilityRefreshKey(
                          (value) => value + 1
                        )
                      }
                      onPointerDown={triggerTapFeedback}
                      sx={{
                        ...secondaryActionSx,
                        mt: 1.5,
                      }}
                    >
                      Reintentar
                    </Button>
                  </div>
                )}

                {todayAvailabilityStatus ===
                  "success" &&
                  todayIsOpen &&
                  todayQuickSlots.length >
                    0 && (
                  <div className="mt-6 grid grid-cols-2 gap-2.5">
                    {todayQuickSlots.map(
                      (slot) => (
                        <button
                          type="button"
                          key={slot.time}
                          onClick={() =>
                            selectTodayTime(
                              slot.label
                            )
                          }
                          onPointerDown={triggerTapFeedback}
                          className="min-h-12 touch-manipulation select-none rounded-xl border border-white/10 bg-white/[0.02] text-[13px] text-white/70 transition-all duration-100 ease-out active:translate-y-[2px] active:scale-[0.94] active:border-[#c5a66d]/70 active:bg-[#c5a66d]/15 active:text-[#f5f1e8] active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)]"
                        >
                          {slot.label}
                        </button>
                      )
                    )}
                  </div>
                )}

                {todayAvailabilityStatus ===
                  "success" &&
                  (!todayIsOpen ||
                    todayQuickSlots.length ===
                      0) && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center">
                    <p className="text-xs text-white/40">
                      {todayIsOpen
                        ? "No quedan cupos rápidos disponibles para hoy."
                        : "Hoy la barbería está cerrada."}
                    </p>
                  </div>
                )}

                <p className="mt-5 border-t border-white/10 pt-4 text-[10px] leading-4 text-white/25">
                  Los horarios mostrados se consultan en tiempo real.
                </p>
              </div>
            </div>

            <div className="-mx-5 mt-2">
              <SocialFooter />
            </div>

            <footer className="flex items-center justify-between border-t border-white/10 pt-5 text-[10px] text-white/25">
              <p>
                Solo con cita previa
              </p>

              <p>
                WAESTUDIO
              </p>
            </footer>
          </section>
        )}

        {step ===
          "calendar" && (
          <section className="flex min-h-[100svh] flex-col px-5 pb-7 pt-5">
            <ScreenHeader
              title="WAESTUDIO"
              onBack={goBack}
            />

            <div className="mt-10">
              <p className="text-[10px] uppercase tracking-[0.35em] text-[#c5a66d]">
                Paso 1
              </p>

              <h2 className="mt-4 text-4xl font-medium tracking-[-0.04em]">
                Elige
                <br />
                <span className="text-white/30">
                  el día.
                </span>
              </h2>
            </div>

            <div className="mt-10 rounded-[30px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    changeMonth(-1)
                  }
                  onPointerDown={triggerTapFeedback}
                  className="flex h-11 w-11 touch-manipulation select-none items-center justify-center rounded-full border border-white/10 text-white/50 transition-all duration-100 ease-out active:translate-y-px active:scale-90 active:border-[#c5a66d]/70 active:bg-[#c5a66d]/10 active:text-[#c5a66d]"
                >
                  ←
                </button>

                <div className="text-center">
                  <p className="text-lg font-medium">
                    {
                      months[
                        currentMonth.getMonth()
                      ]
                    }
                  </p>

                  <p className="mt-1 text-[10px] tracking-[0.2em] text-white/30">
                    {currentMonth.getFullYear()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    changeMonth(1)
                  }
                  onPointerDown={triggerTapFeedback}
                  className="flex h-11 w-11 touch-manipulation select-none items-center justify-center rounded-full border border-white/10 text-white/50 transition-all duration-100 ease-out active:translate-y-px active:scale-90 active:border-[#c5a66d]/70 active:bg-[#c5a66d]/10 active:text-[#c5a66d]"
                >
                  →
                </button>
              </div>

              <div className="mt-7 grid grid-cols-7 gap-1.5">
                {weekDays.map(
                  (
                    day,
                    index
                  ) => (
                    <div
                      key={`${day}-${index}`}
                      className="flex h-8 items-center justify-center text-[10px] text-white/25"
                    >
                      {day}
                    </div>
                  )
                )}

                {calendarDays.map(
                  (
                    day,
                    index
                  ) => {
                    if (!day) {
                      return (
                        <div
                          key={`empty-${index}`}
                        />
                      );
                    }

                    const disabled =
                      isPastDay(
                        day
                      ) ||
                      isSunday(
                        day
                      );

                    return (
                      <button
                        type="button"
                        key={day}
                        disabled={
                          disabled
                        }
                        onClick={() =>
                          selectCalendarDay(
                            day
                          )
                        }
                        onPointerDown={triggerTapFeedback}
                        className={`aspect-square touch-manipulation select-none rounded-full text-xs transition-all duration-100 ease-out ${
                          disabled
                            ? "text-white/15"
                            : "border border-white/10 bg-white/[0.025] text-white/70 active:translate-y-[2px] active:scale-[0.86] active:border-[#c5a66d] active:bg-[#c5a66d]/20 active:text-[#f5f1e8] active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)]"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="mt-auto pt-8">
              <p className="text-center text-[10px] leading-4 text-white/25">
                Los domingos no están disponibles.
              </p>
            </div>
          </section>
        )}

        {step === "time" &&
          selectedDate && (
            <section className="flex min-h-[100svh] flex-col px-5 pb-7 pt-5">
              <ScreenHeader
                title="WAESTUDIO"
                onBack={goBack}
              />

              <div className="mt-10">
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#c5a66d]">
                  Paso 2
                </p>

                <h2 className="mt-4 text-4xl font-medium tracking-[-0.04em]">
                  Elige
                  <br />
                  <span className="text-white/30">
                    la hora.
                  </span>
                </h2>

                <p className="mt-5 text-sm capitalize text-white/40">
                  {formatDate(
                    selectedDate
                  )}
                </p>
              </div>

              {availabilityStatus ===
                "loading" && (
                <div className="mt-10 grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(
                    (item) => (
                      <Skeleton
                        key={item}
                        variant="rounded"
                        animation="wave"
                        height={56}
                        sx={{
                          borderRadius: "16px",
                          backgroundColor: "rgba(255, 255, 255, 0.035)",
                        }}
                      />
                    )
                  )}
                </div>
              )}

              {availabilityStatus ===
                "error" && (
                <div className="mt-10">
                  <Alert
                    severity="error"
                    variant="outlined"
                    sx={{
                      borderRadius: "20px",
                      borderColor: "rgba(248, 113, 113, 0.20)",
                      backgroundColor: "rgba(248, 113, 113, 0.05)",
                      color: "rgba(254, 202, 202, 0.78)",
                    }}
                  >
                    {availabilityError ||
                      "No pudimos consultar los horarios."}
                  </Alert>

                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() =>
                      setAvailabilityRefreshKey(
                        (value) => value + 1
                      )
                    }
                    onPointerDown={triggerTapFeedback}
                    sx={{
                      ...secondaryActionSx,
                      mt: 2,
                    }}
                  >
                    Reintentar
                  </Button>
                </div>
              )}

              {availabilityStatus ===
                "success" &&
                visibleAvailabilitySlots.length >
                  0 && (
                <div className="mt-10 grid grid-cols-2 gap-3">
                  {visibleAvailabilitySlots.map(
                    (slot) => (
                      <button
                        type="button"
                        key={slot.time}
                        onClick={() =>
                          selectTime(
                            slot.label
                          )
                        }
                        onPointerDown={triggerTapFeedback}
                        className="min-h-14 touch-manipulation select-none rounded-2xl border border-white/10 bg-white/[0.035] text-sm text-white/70 transition-all duration-100 ease-out active:translate-y-[2px] active:scale-[0.94] active:border-[#c5a66d] active:bg-[#c5a66d]/20 active:text-[#f5f1e8] active:shadow-[inset_0_2px_9px_rgba(0,0,0,0.38)]"
                      >
                        {slot.label}
                      </button>
                    )
                  )}
                </div>
              )}

              {availabilityStatus ===
                "success" &&
                visibleAvailabilitySlots.length ===
                  0 && (
                <div className="mt-10 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-center">
                  <p className="text-sm text-white/45">
                    No quedan horarios disponibles para este día.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setStep("calendar")
                    }
                    onPointerDown={triggerTapFeedback}
                    className="mt-4 min-h-11 rounded-full border border-[#c5a66d]/30 bg-[#c5a66d]/[0.06] px-5 text-xs text-[#c5a66d] transition-all active:scale-95"
                  >
                    Elegir otro día
                  </button>
                </div>
              )}
            </section>
          )}

        {step ===
          "service" &&
          selectedDate &&
          selectedTime && (
            <section className="flex min-h-[100svh] flex-col px-5 pb-7 pt-5">
              <ScreenHeader
                title="WAESTUDIO"
                onBack={goBack}
              />

              <div className="mt-10">
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#c5a66d]">
                  Paso 3
                </p>

                <h2 className="mt-4 text-4xl font-medium tracking-[-0.04em]">
                  Elige tu
                  <br />
                  <span className="text-white/30">
                    experiencia.
                  </span>
                </h2>

                <div className="mt-5 flex items-center gap-2 text-xs text-white/35">
                  <span className="capitalize">
                    {formatDate(
                      selectedDate
                    )}
                  </span>

                  <span>·</span>

                  <span>
                    {selectedTime}
                  </span>
                </div>
              </div>

              <div className="mt-9 space-y-4">
                {visibleServices.map(
                  (service) => {
                    const serviceVes =
                      bcvRate !==
                      null
                        ? service.price *
                          bcvRate
                        : null;

                    return (
                      <button
                        type="button"
                        key={
                          service.id
                        }
                        onClick={() =>
                          selectService(
                            service
                          )
                        }
                        onPointerDown={triggerTapFeedback}
                        className="w-full touch-manipulation select-none rounded-[28px] border border-white/10 bg-white/[0.035] p-6 text-left transition-all duration-100 ease-out active:translate-y-[2px] active:scale-[0.97] active:border-[#c5a66d]/70 active:bg-[#c5a66d]/10 active:shadow-[inset_0_3px_12px_rgba(0,0,0,0.32)]"
                      >
                        <div className="flex items-start justify-between gap-6">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-[#c5a66d]">
                              {
                                service.duration
                              }
                            </p>

                            <h3 className="mt-3 text-xl font-medium">
                              {
                                service.name
                              }
                            </h3>

                            <p className="mt-2 text-xs leading-5 text-white/35">
                              {
                                service.description
                              }
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-3xl font-medium">
                              $
                              {
                                service.price
                              }
                            </p>

                            {serviceVes !==
                              null && (
                              <p className="mt-1 whitespace-nowrap text-[10px] text-white/30">
                                Bs.{" "}
                                {formatVes(
                                  serviceVes
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 border-t border-white/10 pt-5">
                          <div className="flex flex-wrap gap-2">
                            {service.includes.map(
                              (
                                item
                              ) => (
                                <span
                                  key={
                                    item
                                  }
                                  className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-white/40"
                                >
                                  {
                                    item
                                  }
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}

                {visibleServices.length ===
                  0 && (
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-center">
                    <p className="text-sm text-white/45">
                      No hay servicios disponibles en este horario.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setStep("time")
                      }
                      onPointerDown={triggerTapFeedback}
                      className="mt-4 min-h-11 rounded-full border border-[#c5a66d]/30 bg-[#c5a66d]/[0.06] px-5 text-xs text-[#c5a66d] transition-all active:scale-95"
                    >
                      Elegir otra hora
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

        {step ===
          "details" &&
          selectedDate &&
          selectedTime &&
          selectedService && (
            <section className="flex min-h-[100svh] flex-col px-5 pb-7 pt-5">
              <ScreenHeader
                title="WAESTUDIO"
                onBack={goBack}
              />

              <div className="mt-10">
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#c5a66d]">
                  Paso 4
                </p>

                <h2 className="mt-4 text-4xl font-medium tracking-[-0.04em]">
                  Tus
                  <br />
                  <span className="text-white/30">
                    datos.
                  </span>
                </h2>
              </div>

              <div className="mt-9 space-y-5">
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-white/30">
                    Nombre
                  </label>

                  <TextField
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder="Ej. Rafael Gutiérrez"
                    autoComplete="name"
                    fullWidth
                    sx={textFieldSx}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-white/30">
                    WhatsApp
                  </label>

                  <TextField
                    type="tel"
                    value={whatsapp}
                    onChange={(event) =>
                      setWhatsapp(event.target.value)
                    }
                    placeholder="Ej. 0412 123 4567"
                    autoComplete="tel"
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        inputMode: "tel",
                      },
                    }}
                    sx={textFieldSx}
                  />
                </div>
              </div>

              <div className="mt-8 rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#c5a66d]">
                  Resumen
                </p>

                <div className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-white/30">
                      Servicio
                    </span>

                    <span className="text-right">
                      {
                        selectedService.name
                      }
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-white/30">
                      Fecha
                    </span>

                    <span className="text-right capitalize">
                      {formatDate(
                        selectedDate
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-white/30">
                      Hora
                    </span>

                    <span>
                      {
                        selectedTime
                      }
                    </span>
                  </div>

                  <div className="flex items-end justify-between border-t border-white/10 pt-4">
                    <div>
                      <p className="text-white/30">
                        Total
                      </p>

                      {amountVes !==
                        null && (
                        <p className="mt-1 text-[10px] text-white/25">
                          Bs.{" "}
                          {formatVes(
                            amountVes
                          )}{" "}
                          BCV
                        </p>
                      )}
                    </div>

                    <span className="text-3xl font-medium">
                      $
                      {
                        selectedService.price
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8">
                <Button
                  type="button"
                  variant="contained"
                  fullWidth
                  disableRipple
                  disabled={!validDetails}
                  onClick={() =>
                    setStep(
                      "paymentMethod"
                    )
                  }
                  onPointerDown={triggerTapFeedback}
                  sx={primaryActionSx}
                >
                  Continuar al pago
                </Button>
              </div>
            </section>
          )}

        {step ===
          "paymentMethod" &&
          selectedDate &&
          selectedTime &&
          selectedService && (
            <section className="flex min-h-[100svh] flex-col px-5 pb-8 pt-5">
              <ScreenHeader
                title="WAESTUDIO"
                onBack={goBack}
              />

              <div className="mt-10">
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#c5a66d]">
                  Último paso
                </p>

                <h2 className="mt-4 text-4xl font-medium tracking-[-0.04em]">
                  ¿Cómo quieres
                  <br />
                  <span className="text-white/30">
                    pagar?
                  </span>
                </h2>
              </div>

              <div className="mt-8 rounded-[28px] border border-[#c5a66d]/30 bg-[#c5a66d]/[0.06] p-5">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#c5a66d]">
                  Total de la reserva
                </p>

                <div className="mt-3 flex items-end justify-between gap-4">
                  <p className="text-5xl font-medium">
                    $
                    {
                      selectedService.price
                    }
                  </p>

                  <div className="text-right">
                    <p className="text-[10px] text-white/25">
                      En bolívares
                    </p>

                    {bcvStatus ===
                      "loading" && (
                      <p className="mt-1 text-xs text-white/40">
                        Consultando BCV...
                      </p>
                    )}

                    {bcvStatus ===
                      "success" &&
                      amountVes !==
                        null && (
                        <p className="mt-1 text-lg font-medium text-[#c5a66d]">
                          Bs.{" "}
                          {formatVes(
                            amountVes
                          )}
                        </p>
                      )}

                    {bcvStatus ===
                      "error" && (
                      <p className="mt-1 text-xs text-red-300/70">
                        Tasa no disponible
                      </p>
                    )}
                  </div>
                </div>

                {bcvRate !==
                  null && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] text-white/25">
                          Tasa BCV
                        </p>

                        <p className="mt-1 text-xs text-white/55">
                          1 USD ={" "}
                          {formatBcvRate(
                            bcvRate
                          )}{" "}
                          Bs.
                        </p>
                      </div>

                      {bcvDate && (
                        <p className="text-[10px] text-white/25">
                          {
                            formatBcvDate()
                          }
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {bcvStatus ===
                  "error" && (
                  <Button
                    type="button"
                    variant="outlined"
                    fullWidth
                    onClick={
                      retryBcvRate
                    }
                    onPointerDown={triggerTapFeedback}
                    sx={{
                      ...secondaryActionSx,
                      mt: 2.5,
                      borderRadius: "12px",
                    }}
                  >
                    Reintentar tasa BCV
                  </Button>
                )}
              </div>

              <div className="mt-9 space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    selectPaymentMethod(
                      "mobile"
                    )
                  }
                  onPointerDown={triggerTapFeedback}
                  className="flex min-h-24 w-full touch-manipulation select-none items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.035] p-5 text-left transition-all duration-100 ease-out active:translate-y-[2px] active:scale-[0.96] active:border-[#c5a66d]/70 active:bg-[#c5a66d]/[0.12] active:shadow-[inset_0_3px_12px_rgba(0,0,0,0.34)]"
                >
                  <div>
                    <p className="text-base font-medium">
                      Pago Móvil
                    </p>

                    <p className="mt-1 text-xs text-white/30">
                      Pago en bolívares
                    </p>
                  </div>

                  <span className="text-xl text-[#c5a66d]">
                    →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    selectPaymentMethod(
                      "transfer"
                    )
                  }
                  onPointerDown={triggerTapFeedback}
                  className="flex min-h-24 w-full touch-manipulation select-none items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.035] p-5 text-left transition-all duration-100 ease-out active:translate-y-[2px] active:scale-[0.96] active:border-[#c5a66d]/70 active:bg-[#c5a66d]/[0.12] active:shadow-[inset_0_3px_12px_rgba(0,0,0,0.34)]"
                >
                  <div>
                    <p className="text-base font-medium">
                      Transferencia
                    </p>

                    <p className="mt-1 text-xs text-white/30">
                      Transferencia bancaria
                    </p>
                  </div>

                  <span className="text-xl text-[#c5a66d]">
                    →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    selectPaymentMethod(
                      "cash"
                    )
                  }
                  onPointerDown={triggerTapFeedback}
                  className="flex min-h-24 w-full touch-manipulation select-none items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.035] p-5 text-left transition-all duration-100 ease-out active:translate-y-[2px] active:scale-[0.96] active:border-[#c5a66d]/70 active:bg-[#c5a66d]/[0.12] active:shadow-[inset_0_3px_12px_rgba(0,0,0,0.34)]"
                >
                  <div>
                    <p className="text-base font-medium">
                      Efectivo
                    </p>

                    <p className="mt-1 text-xs text-white/30">
                      Paga al llegar · USD o Bs.
                    </p>
                  </div>

                  <span className="text-xl text-[#c5a66d]">
                    →
                  </span>
                </button>
              </div>

              <div className="mt-auto pt-8">
                <p className="text-center text-[10px] leading-4 text-white/25">
                  Pago Móvil y Transferencia requieren verificación. En efectivo, pagas al llegar al local.
                </p>
              </div>
            </section>
          )}

        {step ===
          "paymentDetails" &&
          selectedDate &&
          selectedTime &&
          selectedService &&
          paymentMethod && (
            <section className="flex min-h-[100svh] flex-col px-5 pb-8 pt-5">
              <ScreenHeader
                title={
                  paymentMethod === "mobile"
                    ? "PAGO MÓVIL"
                    : paymentMethod === "transfer"
                      ? "TRANSFERENCIA"
                      : "EFECTIVO"
                }
                onBack={goBack}
              />

              <div className="mt-9">
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#c5a66d]">
                  WAESTUDIO
                </p>

                <h2 className="mt-4 text-4xl font-medium tracking-[-0.04em]">
                  {paymentMethod === "cash"
                    ? "Paga"
                    : "Realiza"}
                  <br />
                  <span className="text-white/30">
                    {paymentMethod === "cash"
                      ? "al llegar."
                      : "tu pago."}
                  </span>
                </h2>
              </div>

              {paymentMethod === "cash" ? (
                <>
                  <div className="mt-8 rounded-[28px] border border-[#c5a66d]/30 bg-[#c5a66d]/[0.06] p-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-[#c5a66d]">
                      Precio del servicio
                    </p>

                    <p className="mt-2 text-5xl font-medium">
                      ${selectedService.price}
                    </p>

                    <p className="mt-4 border-t border-white/10 pt-4 text-[10px] leading-4 text-white/30">
                      El pago se realizará en efectivo directamente en WAESTUDIO. Esta opción no realiza conversión BCV.
                    </p>
                  </div>

                  <div className="mt-7">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">
                      ¿Qué efectivo llevarás?
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setCashCurrency(
                            "USD"
                          )
                        }
                        onPointerDown={triggerTapFeedback}
                        className={`min-h-24 touch-manipulation select-none rounded-[22px] border p-4 text-left transition-all duration-100 ease-out active:translate-y-[2px] active:scale-[0.96] ${
                          cashCurrency === "USD"
                            ? "border-[#c5a66d]/70 bg-[#c5a66d]/[0.12]"
                            : "border-white/10 bg-white/[0.035]"
                        }`}
                      >
                        <p className="text-base font-medium">
                          Dólares
                        </p>
                        <p className="mt-1 text-xs text-white/30">
                          Efectivo USD
                        </p>
                        {cashCurrency ===
                          "USD" && (
                          <p className="mt-3 text-xs text-[#c5a66d]">
                            ✓ Seleccionado
                          </p>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCashCurrency(
                            "VES"
                          )
                        }
                        onPointerDown={triggerTapFeedback}
                        className={`min-h-24 touch-manipulation select-none rounded-[22px] border p-4 text-left transition-all duration-100 ease-out active:translate-y-[2px] active:scale-[0.96] ${
                          cashCurrency === "VES"
                            ? "border-[#c5a66d]/70 bg-[#c5a66d]/[0.12]"
                            : "border-white/10 bg-white/[0.035]"
                        }`}
                      >
                        <p className="text-base font-medium">
                          Bolívares
                        </p>
                        <p className="mt-1 text-xs text-white/30">
                          Efectivo Bs.
                        </p>
                        {cashCurrency ===
                          "VES" && (
                          <p className="mt-3 text-xs text-[#c5a66d]">
                            ✓ Seleccionado
                          </p>
                        )}
                      </button>
                    </div>

                    {cashCurrency && (
                      <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.035] p-5">
                        <div className="flex justify-between gap-4 text-sm">
                          <span className="text-white/30">
                            Forma de pago
                          </span>
                          <span className="text-right">
                            Efectivo ·{" "}
                            {cashCurrency ===
                            "USD"
                              ? "Dólares"
                              : "Bolívares"}
                          </span>
                        </div>

                        <p className="mt-4 border-t border-white/10 pt-4 text-[10px] leading-4 text-white/30">
                          Tu horario quedará reservado y el barbero verá que el efectivo está pendiente por cobrar en el local.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-8 rounded-[28px] border border-[#c5a66d]/30 bg-[#c5a66d]/[0.06] p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-[#c5a66d]">
                          Monto a pagar
                        </p>

                        {amountVes !==
                          null ? (
                          <p className="mt-2 text-4xl font-medium">
                            Bs.{" "}
                            {formatVes(
                              amountVes
                            )}
                          </p>
                        ) : (
                          <p className="mt-2 text-lg text-white/40">
                            Tasa BCV no disponible
                          </p>
                        )}
                      </div>
                    </div>

                    {bcvRate !==
                      null && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <p className="text-[10px] text-white/30">
                          $
                          {
                            selectedService.price
                          }{" "}
                          ×{" "}
                          {formatBcvRate(
                            bcvRate
                          )}{" "}
                          Bs/USD
                        </p>
                      </div>
                    )}

                    {bcvStatus ===
                      "error" && (
                      <Button
                        type="button"
                        variant="outlined"
                        fullWidth
                        onClick={
                          retryBcvRate
                        }
                        onPointerDown={triggerTapFeedback}
                        sx={{
                          ...secondaryActionSx,
                          mt: 2.5,
                          borderRadius: "12px",
                        }}
                      >
                        Reintentar tasa BCV
                      </Button>
                    )}
                  </div>

                  <div className="mt-6 rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-[#c5a66d]">
                      Datos para pagar
                    </p>

                    {paymentMethod ===
                    "mobile" ? (
                      <div className="mt-5 space-y-4 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-white/30">
                            Banco
                          </span>

                          <span>
                            Banesco
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-white/30">
                            Teléfono
                          </span>

                          <span>
                            0412-0000000
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-white/30">
                            Cédula
                          </span>

                          <span>
                            V-00.000.000
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-4 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-white/30">
                            Banco
                          </span>

                          <span>
                            Banesco
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-white/30">
                            Cuenta
                          </span>

                          <span className="text-right">
                            0134-0000-00-0000000000
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-white/30">
                            Titular
                          </span>

                          <span>
                            WAESTUDIO
                          </span>
                        </div>
                      </div>
                    )}

                    <p className="mt-5 border-t border-white/10 pt-4 text-[10px] leading-4 text-white/25">
                      Estos datos bancarios son demostrativos. Luego colocaremos los datos reales de WAESTUDIO.
                    </p>
                  </div>

                  <div className="mt-7 space-y-5">
                    <div>
                      <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-white/30">
                        Banco desde donde pagaste
                      </label>

                      <TextField
                        type="text"
                        value={bank}
                        onChange={(event) =>
                          setBank(event.target.value)
                        }
                        placeholder="Ej. Mercantil"
                        fullWidth
                        sx={textFieldSx}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-white/30">
                        Número de referencia
                      </label>

                      <TextField
                        type="text"
                        value={reference}
                        onChange={(event) =>
                          setReference(event.target.value)
                        }
                        placeholder="Ej. 583926"
                        fullWidth
                        slotProps={{
                          htmlInput: {
                            inputMode: "numeric",
                          },
                        }}
                        sx={textFieldSx}
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/30">
                        Comprobante
                      </p>

                      <label
                        htmlFor="receipt"
                        onPointerDown={triggerTapFeedback}
                        className={`flex min-h-28 w-full touch-manipulation select-none cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed px-5 text-center transition-all duration-100 ease-out active:translate-y-[2px] active:scale-[0.98] ${
                          receipt
                            ? "border-[#c5a66d]/60 bg-[#c5a66d]/[0.06]"
                            : "border-white/15 bg-white/[0.025]"
                        }`}
                      >
                        {receipt ? (
                          <>
                            <span className="text-xl text-[#c5a66d]">
                              ✓
                            </span>

                            <span className="mt-2 max-w-full truncate text-xs text-white/70">
                              {
                                receipt.name
                              }
                            </span>

                            <span className="mt-1 text-[10px] text-white/30">
                              Toca para cambiar
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-2xl text-white/40">
                              +
                            </span>

                            <span className="mt-2 text-xs text-white/60">
                              Subir captura del pago
                            </span>

                            <span className="mt-1 text-[10px] text-white/25">
                              Selecciona una imagen desde tu teléfono
                            </span>
                          </>
                        )}

                        <input
                          id="receipt"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={
                            handleReceipt
                          }
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="mt-8">
                <Button
                  type="button"
                  variant="contained"
                  fullWidth
                  disableRipple
                  disabled={
                    !validPayment ||
                    paymentSubmitting
                  }
                  onClick={
                    reportPayment
                  }
                  onPointerDown={triggerTapFeedback}
                  startIcon={
                    paymentSubmitting ? (
                      <CircularProgress
                        size={16}
                        thickness={5}
                        sx={{
                          color: "rgba(9, 9, 9, 0.55)",
                        }}
                      />
                    ) : undefined
                  }
                  sx={primaryActionSx}
                >
                  {paymentSubmitting
                    ? "Registrando reserva..."
                    : paymentMethod ===
                        "cash"
                      ? "Reservar cita"
                      : "Reportar pago"}
                </Button>

                {paymentError && (
                  <Alert
                    severity="error"
                    variant="outlined"
                    sx={{
                      mt: 1.5,
                      borderRadius: "12px",
                      borderColor: "rgba(248, 113, 113, 0.20)",
                      backgroundColor: "rgba(248, 113, 113, 0.06)",
                      color: "rgba(254, 202, 202, 0.82)",
                      fontSize: 11,
                    }}
                  >
                    {paymentError}
                  </Alert>
                )}

                {paymentMethod !==
                  "cash" &&
                  bcvRate ===
                    null && (
                    <p className="mt-3 text-center text-[10px] text-white/25">
                      Necesitamos obtener la tasa BCV antes de reportar el pago.
                    </p>
                  )}
              </div>
            </section>
          )}

        {step ===
          "success" &&
          selectedDate &&
          selectedTime &&
          selectedService && (
            <section className="flex min-h-[100svh] flex-col px-5 pb-8 pt-5">
              <div className="flex flex-1 flex-col justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#c5a66d]/40 bg-[#c5a66d]/10 text-2xl text-[#c5a66d]">
                  ✓
                </div>

                <p className="mt-8 text-[10px] uppercase tracking-[0.35em] text-[#c5a66d]">
                  Cita reservada
                </p>

                <h2 className="mt-4 text-4xl font-medium tracking-[-0.04em]">
                  Tu cita
                  <br />
                  <span className="text-white/30">
                    quedó reservada.
                  </span>
                </h2>

                <p className="mt-5 text-sm leading-6 text-white/40">
                  {paymentMethod === "cash"
                    ? `Pagarás en efectivo al llegar a WAESTUDIO, en ${
                        cashCurrency === "USD"
                          ? "dólares"
                          : "bolívares"
                      }.`
                    : "Tu horario ya quedó reservado. El comprobante de pago aún no se ha enviado ni verificado: compártelo con WAESTUDIO por WhatsApp usando las opciones de abajo."}
                </p>

                {bookingCode && (
                  <div className="mt-6 rounded-2xl border border-[#c5a66d]/30 bg-[#c5a66d]/[0.06] px-4 py-4">
                    <p className="text-[9px] uppercase tracking-[0.28em] text-[#c5a66d]">
                      Código de reserva
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-[0.08em] text-[#f5f1e8]">
                      {bookingCode}
                    </p>
                  </div>
                )}

                <div className="mt-9 rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-white/30">
                        Cliente
                      </span>

                      <span className="text-right">
                        {name}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-white/30">
                        Servicio
                      </span>

                      <span className="text-right">
                        {
                          selectedService.name
                        }
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-white/30">
                        Fecha
                      </span>

                      <span className="text-right capitalize">
                        {formatDate(
                          selectedDate
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-white/30">
                        Hora
                      </span>

                      <span>
                        {
                          selectedTime
                        }
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-white/30">
                        Pago
                      </span>

                      <span className="text-right">
                        {paymentMethod === "cash"
                          ? `Efectivo · ${
                              cashCurrency === "USD"
                                ? "Dólares"
                                : "Bolívares"
                            }`
                          : paymentMethod === "mobile"
                            ? "Pago Móvil"
                            : "Transferencia"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-white/30">
                        Total
                      </span>

                      <div className="text-right">
                        <p>
                          $
                          {
                            selectedService.price
                          }
                          {paymentMethod ===
                            "cash" &&
                            cashCurrency ===
                              "VES" && (
                              <span className="ml-1 text-[10px] font-normal text-white/30">
                                referencia
                              </span>
                            )}
                        </p>

                        {paymentMethod !==
                          "cash" &&
                          amountVes !==
                            null && (
                            <p className="mt-1 text-[10px] text-white/30">
                              Bs.{" "}
                              {formatVes(
                                amountVes
                              )}
                            </p>
                          )}

                        {paymentMethod ===
                          "cash" &&
                          cashCurrency ===
                            "VES" && (
                            <p className="mt-1 text-[10px] text-white/30">
                              Efectivo en bolívares · sin conversión BCV en la app
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="flex justify-between gap-4 border-t border-white/10 pt-4">
                      <span className="text-white/30">
                        Estado
                      </span>

                      <span className="text-right text-[#c5a66d]">
                        {paymentMethod === "cash"
                          ? "Efectivo pendiente al llegar"
                          : "Comprobante pendiente de verificar"}
                      </span>
                    </div>
                  </div>
                </div>

                {(paymentMethod === "mobile" ||
                  paymentMethod === "transfer") && (
                  <PaymentWhatsApp
                    customerName={name}
                    customerWhatsapp={whatsapp}
                    bookingCode={bookingCode}
                    serviceName={selectedService.name}
                    appointmentDate={formatDate(selectedDate)}
                    appointmentTime={selectedTime}
                    amountUsd={selectedService.price}
                    amountVes={amountVes}
                    paymentMethod={paymentMethod}
                    bank={bank}
                    reference={reference}
                    receipt={receipt}
                  />
                )}
              </div>

              <Button
                type="button"
                variant="contained"
                fullWidth
                disableRipple
                onClick={
                  startNewBooking
                }
                onPointerDown={triggerTapFeedback}
                sx={{ ...primaryActionSx, mt: 3 }}
              >
                Volver al inicio
              </Button>
            </section>
          )}
      </div>
    </main>
  );
}