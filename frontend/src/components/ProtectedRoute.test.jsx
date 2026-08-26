import {
    describe,
    expect,
    it,
} from "vitest";
import {
    MemoryRouter,
    Route,
    Routes,
} from "react-router-dom";
import {
    render,
    screen,
} from "@testing-library/react";

import ProtectedRoute from "./ProtectedRoute";
import { AuthContext } from "../context/authContextBase";

const renderProtectedRoute = ({
    user,
    loading,
}) => {
    return render(
        <AuthContext.Provider
            value={{
                user,
                loading,
            }}
        >
            <MemoryRouter
                initialEntries={[
                    "/dashboard",
                ]}
            >
                <Routes>
                    <Route
                        path="/login"
                        element={
                            <div>
                                Login page
                            </div>
                        }
                    />

                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <div>
                                    Protected content
                                </div>
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>
    );
};

describe("ProtectedRoute", () => {

    it("renders protected content for an authenticated user", () => {
        renderProtectedRoute({
            user: {
                id: 1,
                username: "jelena",
            },
            loading: false,
        });

        expect(
            screen.getByText(
                "Protected content"
            )
        ).toBeInTheDocument();

        expect(
            screen.queryByText(
                "Login page"
            )
        ).not.toBeInTheDocument();
    });

    it("redirects unauthenticated users to login", () => {
        renderProtectedRoute({
            user: null,
            loading: false,
        });

        expect(
            screen.getByText(
                "Login page"
            )
        ).toBeInTheDocument();

        expect(
            screen.queryByText(
                "Protected content"
            )
        ).not.toBeInTheDocument();
    });

    it("does not render protected content while authentication is loading", () => {
        renderProtectedRoute({
            user: null,
            loading: true,
        });

        expect(
            screen.queryByText(
                "Protected content"
            )
        ).not.toBeInTheDocument();

        expect(
            screen.queryByText(
                "Login page"
            )
        ).not.toBeInTheDocument();
    });

});