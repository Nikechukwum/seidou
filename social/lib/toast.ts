import { store } from "@/redux/store";
import { showToast } from "@/redux/toastSlice";

/**
 * Drop-in replacement for the `toast` export from sonner, which the ported
 * code calls in ~30 places. Routing it to Seidou's existing Redux toast means
 * the app has one notification system instead of two, and the ported call
 * sites stay untouched apart from their import path.
 *
 *   - import { toast } from "sonner";
 *   + import { toast } from "@/social/lib/toast";
 *
 * Dispatches on the imported store singleton rather than via useDispatch:
 * most call sites are inside React Query onSuccess/onError callbacks, which
 * are not React render scope and so cannot use hooks.
 *
 * `components/Toast.tsx` is already mounted in the root layout and renders it.
 */
export const toast = {
  success: (message: string) =>
    store.dispatch(showToast({ message, type: "success" })),

  error: (message: string) =>
    store.dispatch(showToast({ message, type: "error" })),
};
