import { ReactNode } from "react";
import { Button } from "./Button";
import Image from "next/image";

type Props = {
  title: string;
  description: string;
  buttonText: string;
  img?: string;
  imgOverlay?: ReactNode;
  onClick?: ()=>void
}

const BigCard = ({title, description, buttonText, img, imgOverlay, onClick}: Props) => {
  return (
      <div className="w-full overflow-hidden bg-white shadow-sm rounded-4xl">
        
        {/* Upper Section */}
        <div className="relative flex h-40 items-center justify-center bg-gray-500">
          {img && <Image src={img} alt="card image" fill objectFit="cover"/>}
          {imgOverlay}
        </div>

        {/* Lower Section */}
        <div className="p-5 pb-8 space-y-4">
          <h2 className="mb-4 text-xl font-bold">
            {title}
          </h2>
          
          <p className="leading-relaxed text-slate-500 text-sm">
            {description}
          </p>

          {/* Action Button */}
          <Button text={buttonText} bordered classname="w-full"/>
        </div>
      </div>
  );
};

export default BigCard;