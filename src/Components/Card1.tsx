import type React from "react"
import "./Card1.css"

interface Props {
    mode: string,
    text: string,
    header: string,
    count: number
}

const Card1: React.FC<Props> = ({ mode, text, header, count }) => {
    return (
        <div id="card" className={mode == 'light' ? 'lightCard' : 'darkCard'}>
            <p className="number">{count}</p>
            <div className="cont">
                <h1>{header}</h1>
                <p>{text}</p>
            </div>
        </div>
    )
}

export default Card1