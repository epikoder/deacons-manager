import { cloneElement, HTMLAttributes, ReactElement, ReactNode, useState } from "react";

export default function DropDown(
    { children, is_active, className }: {
        children: (_: boolean) => [ReactElement, ReactNode];
        is_active?: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
        className?: HTMLAttributes<HTMLDivElement>['className']
    },
) {
    const [_isActive, _setIsActive] = is_active ?? useState(false)
    const [handle, widget] = children(_isActive)

    return (
        <div>
            {cloneElement(handle as ReactElement, {
                onClick() {
                    _setIsActive(!_isActive)
                },
            })}
            {_isActive && (
                <div className={className}>
                    {widget}
                </div>
            )}
        </div>
    );
}
