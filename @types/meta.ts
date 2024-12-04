// https://vike.dev/pageContext#typescript
declare global {
  namespace Vike {
    interface PageContext {
      config: {
        ready: boolean;
        user?: User;
        bookCost: number;
      };
    }
  }
}

export {};
