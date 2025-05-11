import {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

function useRoute() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const onRouteChange = () => {
      setRoute(window.location.hash);
    };

    window.addEventListener("hashchange", onRouteChange);

    return () => {
      window.removeEventListener("hashchange", onRouteChange);
    };
  }, []);

  return route;
}

function useAutoAttach(attachFunction: () => boolean) {
  const [attached, setAttached] = useState(false);
  const route = useRoute();

  useEffect(() => {
    const id = setInterval(() => {
      const result = attachFunction();
      setAttached(result);
      if (result) clearInterval(id);
    }, 100);

    return () => {
      clearInterval(id);
    };
  }, [route, attachFunction]);

  return { attached };
}

function getInputField() {
  const inputField = document.querySelector("div[aria-multiline='true']");
  return inputField;
}

function useLastThreadContent() {
  const [content, setContent] = useState("");
  const attachFunction = useCallback(() => {
    const gmailContent = document.querySelectorAll(".adn")?.[0];
    const threadContent = gmailContent?.querySelectorAll(".ii")?.[0];
    if (!threadContent) return false;

    setContent(
      threadContent.textContent.split("Fra: ")[0].replace("\n\n", " ")
    );
    return true;
  }, []);

  useAutoAttach(attachFunction);
  return content;
}

export default function App() {
  const lastThreadContent = useLastThreadContent();
  const attachFunction = useCallback(() => {
    if (!lastThreadContent) return false;
    const inputField = getInputField();
    if (!inputField) return false;
    if (document.getElementById("thread-ai-wrapper")) return;

    const div = document.createElement("div");
    div.id = "thread-ai-wrapper";

    createRoot(div).render(
      <ButtonSection
        currentThread={lastThreadContent}
        onCompletion={(completion) => {
          if (!inputField) return;
          inputField.innerHTML = completion;
        }}
      />
    );
    inputField.parentElement.parentElement.prepend(div);

    return true;
  }, [lastThreadContent]);

  useAutoAttach(attachFunction);

  return <div className="content-view"></div>;
}

// four buttons on one row with flex inline styles
const Wrapper = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      display: "inline",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: "20px",
    }}
  >
    {children}
  </div>
);

const Button = (
  props: DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
) => (
  <button
    {...props}
    style={{
      flex: 1,
      margin: "0 5px",
      padding: ".5em",
      borderRadius: "8px",
      border: "1px solid #f5f5f5",
      background: "none",
      cursor: "pointer",
      ...props.style,
    }}
  >
    {props.children}
  </button>
);

const prompts = {
  formelt: "Svaret skal være formelt, og passe i jobbsammenheng",
  lekent:
    "Svaret skal være lekent, morsomt, og inneholde emojis. Inkluder gjerne en vits som er relevant til svaret",
  vennlig: "Svaret skal være vennlig, med en hyggelig tone",
  krevende:
    "Svaret skal være krevende, og inneholde en utfordring. Gjerne still flere spørsmål enn du svarer på",
  sarkastisk:
    "Svaret skal være sarkastisk, og inneholde en ironisk tone. Vær kjempefrekk, og anklagende mot den som har sendt e-posten",
} as const;
type PromptTypes = keyof typeof prompts;

const ButtonSection = ({
  currentThread,
  onCompletion,
}: {
  currentThread: string;
  onCompletion: (result: string) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<PromptTypes>();
  const [tone, setTone] = useState("accept");

  const onClick = async (type: PromptTypes) => {
    setType(type);
    setLoading(true);

    const prompt = `Her kommer en e-post jeg har mottatt. ${
      tone === "reject"
        ? "Jeg er ikke interessert i det motparten tilbyr for øyeblikket"
        : ""
    } Kan du hjelpe meg med å svare? Bruk avsnitt før signaturen. ${
      prompts[type]
    }
    E-post: ${currentThread}
    Svar:`;
    const response = await fetch(
      "https://api.openai.com/v1/engines/text-davinci-003/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${"openai-api-key"}`,
        },
        body: JSON.stringify({
          prompt,
          max_tokens: 400,
          temperature: 0.7,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
          best_of: 1,
        }),
      }
    );
    const data = await response.json();
    onCompletion(data.choices[0].text);
    setLoading(false);
  };

  return (
    <Wrapper>
      {loading ? (
        <Button disabled>{`Laster et ${type} svar...`}</Button>
      ) : (
        <>
          <Button
            onClick={() => setTone("accept")}
            style={{ background: tone === "accept" ? "#e6f7ff" : "none" }}
          >
            Godta
          </Button>
          <Button
            onClick={() => setTone("reject")}
            style={{ background: tone === "reject" ? "#e6f7ff" : "none" }}
          >
            Avslå
          </Button>

          <Button onClick={() => onClick("formelt")}>Formell 💼</Button>
          <Button onClick={() => onClick("lekent")}>Lekent 😜</Button>
          <Button onClick={() => onClick("vennlig")}>Vennlig 👭</Button>
          <Button onClick={() => onClick("sarkastisk")}>Sarkastisk 😑</Button>
          <Button onClick={() => onClick("krevende")}>Krevende 🤓</Button>
        </>
      )}
    </Wrapper>
  );
};
