<?php

namespace WebRobot;

interface LoginCheckerInterface {
    /**
     * Checks if the user is logged in and authorized.
     *
     * @return bool|string Returns true if logged in, or a URL string to redirect to if not.
     */
    public function isLoggedIn();
}