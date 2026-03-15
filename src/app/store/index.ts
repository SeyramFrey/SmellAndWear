import { ActionReducerMap } from "@ngrx/store";
import { LayoutState, layoutReducer } from "./layouts/layout-reducers";
import { EcommerceState, ecommercerReducer } from "./Ecommerce/ecommerce_reducer";

export interface RootReducerState {
    layout: LayoutState;
    Ecommerce: EcommerceState;
}

export const rootReducer: ActionReducerMap<RootReducerState> = {
    layout: layoutReducer,
    Ecommerce: ecommercerReducer,
}
