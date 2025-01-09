import { useState } from "react";

const useRender = () => {
    const [_, setState] = useState(0);

    return () => {
        setState((prev) => prev + 1);
    };
};
export default useRender;
