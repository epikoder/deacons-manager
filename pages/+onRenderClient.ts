import { onRenderClient } from "vike-react/__internal/integration/onRenderClient";
import { PageContextClient } from "vike/types";
import { guardClient } from "../src/utils/guard";
import "../assets/css/index.css";
import "../assets/css/toast.css";
import './impl';

export default function (pageContext: PageContextClient) {
  // https://github.com/vikejs/vike/issues/1916
  // wka
  guardClient(pageContext, onRenderClient);
}
